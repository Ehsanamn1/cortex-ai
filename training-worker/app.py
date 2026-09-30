import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx
import torch
from datasets import Dataset
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from peft import LoraConfig, PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer

APP_SECRET = os.getenv("TRAINER_SHARED_SECRET", "")
TRAINING_ROOT = Path(os.getenv("TRAINING_ROOT", "/models/cortex-training"))
DEFAULT_BASE_MODEL = os.getenv("TRAINING_BASE_MODEL", "Qwen/Qwen3-0.6B")
CALLBACK_URL = os.getenv("TRAINING_CALLBACK_URL", "")
CALLBACK_SECRET = os.getenv("TRAINING_CALLBACK_SECRET", "")
MAX_SAMPLES = int(os.getenv("TRAINING_MAX_SAMPLES", "5000"))

app = FastAPI(title="Cortex AI Fine-Tuning Worker", version="1.0.0")
job_lock = threading.Lock()
jobs: dict[str, dict[str, Any]] = {}
model_lock = threading.Lock()
loaded_models: dict[str, tuple[Any, Any]] = {}
executor = ThreadPoolExecutor(max_workers=1)

class ChatMessage(BaseModel):
    role: str
    content: str

class TrainRequest(BaseModel):
    job_id: str = Field(min_length=6, max_length=120)
    base_model: str = ""
    method: str = "qlora"
    samples: list[dict[str, Any]]
    config: dict[str, Any] = {}

class ChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=180)
    messages: list[ChatMessage]
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.3, ge=0, le=2)

def auth_ok(value: str | None) -> bool:
    return bool(APP_SECRET) and value == f"Bearer {APP_SECRET}"

def set_status(job_id: str, **values: Any) -> None:
    jobs.setdefault(job_id, {}).update(values)

def normalize_samples(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for sample in samples[:MAX_SAMPLES]:
        messages = sample.get("messages")
        if not isinstance(messages, list) or len(messages) < 2:
            continue
        cleaned = []
        for msg in messages:
            if not isinstance(msg, dict):
                continue
            role = str(msg.get("role", "")).strip()
            content = str(msg.get("content", "")).strip()
            if role not in {"system", "user", "assistant"} or not content:
                continue
            cleaned.append({"role": role, "content": content[:12000]})
        if any(m["role"] == "assistant" for m in cleaned):
            out.append({"messages": cleaned})
    return out

def callback(job_id: str, payload: dict[str, Any]) -> None:
    if not CALLBACK_URL or not CALLBACK_SECRET:
        return
    try:
        httpx.post(
            CALLBACK_URL,
            json={"jobId": job_id, **payload},
            headers={"Authorization": f"Bearer {CALLBACK_SECRET}"},
            timeout=20.0,
        )
    except Exception:
        pass

def train_job(req: TrainRequest) -> None:
    job_id = req.job_id
    base_model = (req.base_model or DEFAULT_BASE_MODEL).strip()
    method = req.method if req.method in {"lora", "qlora", "full"} else "qlora"
    output_dir = TRAINING_ROOT / job_id
    trainer = None
    model = None
    try:
        with job_lock:
            set_status(job_id, status="running", started_at=time.time(), base_model=base_model)

        samples = normalize_samples(req.samples)
        if len(samples) < 8:
            raise RuntimeError("At least 8 valid training examples are required.")

        output_dir.mkdir(parents=True, exist_ok=True)
        dataset = Dataset.from_list(samples)
        eval_count = max(1, min(len(samples) // 10, 64))
        split = dataset.train_test_split(test_size=eval_count, seed=42)
        train_ds, eval_ds = split["train"], split["test"]

        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=False)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        load_kwargs: dict[str, Any] = {"trust_remote_code": False}
        use_cuda = torch.cuda.is_available()
        if use_cuda:
            load_kwargs["dtype"] = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        if method == "qlora" and use_cuda:
            compute_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            load_kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=compute_dtype,
                bnb_4bit_use_double_quant=True,
            )
            load_kwargs["device_map"] = "auto"

        model = AutoModelForCausalLM.from_pretrained(base_model, **load_kwargs)
        if hasattr(model.config, "use_cache"):
            model.config.use_cache = False

        peft_config = None
        if method in {"lora", "qlora"}:
            peft_config = LoraConfig(
                r=int(req.config.get("lora_r", 16)),
                lora_alpha=int(req.config.get("lora_alpha", 32)),
                lora_dropout=float(req.config.get("lora_dropout", 0.05)),
                bias="none",
                task_type="CAUSAL_LM",
            )

        args = SFTConfig(
            output_dir=str(output_dir),
            num_train_epochs=float(req.config.get("epochs", 1.0)),
            learning_rate=float(req.config.get("learning_rate", 2e-4 if peft_config else 2e-5)),
            per_device_train_batch_size=int(req.config.get("batch_size", 1)),
            per_device_eval_batch_size=int(req.config.get("eval_batch_size", 1)),
            gradient_accumulation_steps=int(req.config.get("gradient_accumulation_steps", 8)),
            logging_steps=max(1, int(req.config.get("logging_steps", 5))),
            save_strategy="no",
            eval_strategy="steps",
            eval_steps=max(1, int(req.config.get("eval_steps", 10))),
            report_to="none",
            max_length=int(req.config.get("max_length", 2048)),
            gradient_checkpointing=True,
            packing=False,
            assistant_only_loss=False,
            seed=42,
            bf16=bool(use_cuda and torch.cuda.is_bf16_supported()),
            fp16=bool(use_cuda and not torch.cuda.is_bf16_supported()),
        )

        trainer = SFTTrainer(
            model=model,
            args=args,
            train_dataset=train_ds,
            eval_dataset=eval_ds,
            processing_class=tokenizer,
            peft_config=peft_config,
        )
        train_result = trainer.train()
        metrics = trainer.evaluate()
        if peft_config is not None:
            trainer.model.save_pretrained(str(output_dir / "adapter"), safe_serialization=True)
        else:
            trainer.save_model(str(output_dir / "model"))

        artifact_dir = output_dir / ("adapter" if peft_config is not None else "model")
        metadata = {
            "job_id": job_id,
            "base_model": base_model,
            "method": method,
            "samples": len(samples),
            "train_examples": len(train_ds),
            "eval_examples": len(eval_ds),
            "train_loss": float(getattr(train_result, "training_loss", 0.0) or 0.0),
            "eval_loss": float(metrics.get("eval_loss", 0.0) or 0.0),
            "artifact_path": str(artifact_dir),
        }
        (output_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
        set_status(job_id, status="completed", **metadata, completed_at=time.time())
        callback(job_id, metadata)
    except Exception as exc:
        set_status(job_id, status="failed", error=str(exc)[:1500], completed_at=time.time())
        callback(job_id, {"error": str(exc)[:1500]})
    finally:
        if trainer is not None:
            del trainer
        if model is not None:
            del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

def load_runtime_model(model_id: str):
    metadata_path = TRAINING_ROOT / model_id / "metadata.json"
    if not metadata_path.exists():
        raise FileNotFoundError(model_id)
    metadata = json.loads(metadata_path.read_text())
    cache_key = model_id + ":" + metadata["artifact_path"]
    with model_lock:
        if cache_key in loaded_models:
            return loaded_models[cache_key]

        base_model = metadata["base_model"]
        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=False)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        dtype = (
            torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported()
            else torch.float16 if torch.cuda.is_available()
            else torch.float32
        )
        base = AutoModelForCausalLM.from_pretrained(
            base_model,
            dtype=dtype,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=False,
        )
        if metadata.get("method") in {"lora", "qlora"}:
            model = PeftModel.from_pretrained(base, metadata["artifact_path"])
        else:
            model = base
        model.eval()
        loaded_models[cache_key] = (tokenizer, model)
        return tokenizer, model

@app.get("/health")
def health():
    return {
        "ok": True,
        "cuda": torch.cuda.is_available(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "running_jobs": sum(1 for j in jobs.values() if j.get("status") == "running"),
    }

@app.post("/v1/train")
def start_train(req: TrainRequest, background_tasks: BackgroundTasks, authorization: str | None = Header(default=None)):
    if not auth_ok(authorization):
        raise HTTPException(status_code=401, detail="unauthorized")
    if len(req.samples) > MAX_SAMPLES:
        raise HTTPException(status_code=400, detail=f"too many samples; max={MAX_SAMPLES}")
    if req.job_id in jobs:
        return {"job_id": req.job_id, "status": jobs[req.job_id].get("status", "unknown")}
    jobs[req.job_id] = {"status": "queued", "created_at": time.time()}
    executor.submit(train_job, req)
    return {"job_id": req.job_id, "status": "queued", "base_model": req.base_model or DEFAULT_BASE_MODEL}

@app.get("/v1/train/{job_id}")
def get_job(job_id: str, authorization: str | None = Header(default=None)):
    if not auth_ok(authorization):
        raise HTTPException(status_code=401, detail="unauthorized")
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="not found")
    return jobs[job_id]

@app.post("/v1/chat/completions")
def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    if not auth_ok(authorization):
        raise HTTPException(status_code=401, detail="unauthorized")
    model_key = req.model.replace("cortex-adapter:", "", 1)
    try:
        tokenizer, model = load_runtime_model(model_key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"model unavailable: {exc}")

    prompt = tokenizer.apply_chat_template(
        [message.model_dump() for message in req.messages],
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {key: value.to(model.device) for key, value in inputs.items()}

    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=req.max_tokens,
            temperature=max(req.temperature, 1e-5),
            do_sample=req.temperature > 0,
            pad_token_id=tokenizer.pad_token_id,
        )

    generated = output[0][inputs["input_ids"].shape[1]:]
    content = tokenizer.decode(generated, skip_special_tokens=True).strip()
    return {
        "id": f"chatcmpl-{int(time.time()*1000)}",
        "object": "chat.completion",
        "model": req.model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
    }
