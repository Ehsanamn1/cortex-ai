"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { hasError:false, message:"" };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError:true, message:error instanceof Error ? error.message : "خطای غیرمنتظره‌ای رخ داد." };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[cortex] view render error:", error, info.componentStack);
  }

  reset = () => this.setState({hasError:false, message:""});

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-3xl border border-destructive/20 bg-destructive/[.03] px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive"><AlertTriangle className="size-5" /></span>
          <div className="max-w-lg space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">این بخش با خطا مواجه شد</h2>
            <p className="text-sm leading-7 text-muted-foreground">{this.state.message || "لطفاً دوباره تلاش کنید."}</p>
          </div>
          <Button onClick={this.reset}><RefreshCw />تلاش مجدد</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
