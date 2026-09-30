# Cortex AI Training Worker

این سرویس، لایهٔ محاسباتی فاین‌تیون واقعی Cortex است. Cloudflare Worker خود Cortex orchestration، احراز هویت، دیتاست، ارزیابی و routing را انجام می‌دهد و این سرویس روی GPU آموزش واقعی را اجرا می‌کند.

## روش‌ها

- `qlora`: آموزش adapter روی مدل پایهٔ frozen با 4-bit quantization.
- `lora`: آموزش adapter بدون quantization.
- `full`: فاین‌تیون کامل وزن‌های مدل؛ برای مدل‌های کوچک/سخت‌افزار مناسب.

TRL/PEFT برای SFT و LoRA/QLoRA استفاده می‌شوند. فرمت دیتاست conversational است و شامل `messages` با نقش‌های system/user/assistant است.

## متغیرهای محیطی

- `TRAINER_SHARED_SECRET`
- `TRAINING_BASE_MODEL` (پیش‌فرض: `Qwen/Qwen3-0.6B`)
- `TRAINING_ROOT`
- `TRAINING_CALLBACK_URL`
- `TRAINING_CALLBACK_SECRET`
- `TRAINING_MAX_SAMPLES`

## Endpointها

- `GET /health`
- `POST /v1/train`
- `GET /v1/train/{job_id}`
- `POST /v1/chat/completions`

برای production، این سرویس را روی یک ماشین GPU اجرا کنید و فقط از طریق شبکهٔ خصوصی/HTTPS با Cortex متصل کنید. کلید Provider و دادهٔ مشتری نباید در UI عمومی نمایش داده شود.
