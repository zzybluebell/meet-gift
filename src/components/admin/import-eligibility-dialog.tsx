"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportResult = {
  ok: boolean;
  received: number;
  matched: number;
  created: number;
  notFound: string[];
  mode: string;
  error?: string;
};

export function ImportEligibilityDialog({ campaignId, currentCount }: { campaignId: string; currentCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("append");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) return;
    setSubmitting(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    const res = await fetch(`/api/campaigns/${campaignId}/eligibility/import`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setResult({ ...data, ok: res.ok });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  function reset() {
    setFile(null);
    setResult(null);
    setSubmitting(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4" />
          导入名单
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入资格名单</DialogTitle>
          <DialogDescription>
            上传 Excel（首列为工号），覆盖或追加到当前 {currentCount} 人的资格名单
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* 模式选择 */}
            <div>
              <div className="text-sm font-medium mb-2">导入模式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("append")}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left text-sm transition-all",
                    mode === "append" ? "border-primary bg-primary/5" : "border-input"
                  )}
                >
                  <div className="font-medium">追加</div>
                  <div className="text-xs text-muted-foreground mt-1">保留现有，仅新增</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left text-sm transition-all",
                    mode === "replace" ? "border-primary bg-primary/5" : "border-input"
                  )}
                >
                  <div className="font-medium text-warning">替换</div>
                  <div className="text-xs text-muted-foreground mt-1">清空 + 重建</div>
                </button>
              </div>
            </div>

            {/* 文件选择 */}
            <div>
              <div className="text-sm font-medium mb-2">Excel 文件</div>
              <label
                className={cn(
                  "block rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all",
                  file ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    {file.name}
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <div className="text-sm">点击选择 Excel 文件</div>
                    <div className="text-xs text-muted-foreground mt-1">支持 .xlsx / .xls / .csv</div>
                  </div>
                )}
              </label>
              <div className="text-xs text-muted-foreground mt-2">
                💡 首列或标题为"工号" / "employeeNo" 的列将被识别
              </div>
            </div>
          </div>
        ) : (
          <ImportResultView result={result} />
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                取消
              </Button>
              <Button onClick={submit} disabled={!file || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                开始导入
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                继续导入
              </Button>
              <Button onClick={() => setOpen(false)}>完成</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportResultView({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg bg-destructive/10 text-destructive p-4 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">导入失败</div>
          <div className="text-sm mt-1">{result.error || "未知错误"}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-success/10 text-success p-4 flex items-start gap-2">
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">导入完成</div>
          <div className="text-sm mt-1">
            读取 {result.received} 行，匹配 {result.matched} 人，新增 {result.created} 条资格
          </div>
        </div>
      </div>
      {result.notFound.length > 0 && (
        <div className="rounded-lg bg-warning/10 p-3">
          <div className="text-sm font-medium text-warning mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {result.notFound.length} 个工号未在系统中找到
          </div>
          <div className="flex flex-wrap gap-1">
            {result.notFound.slice(0, 20).map((no) => (
              <Badge key={no} variant="warning" className="font-mono text-[10px]">
                {no}
              </Badge>
            ))}
            {result.notFound.length > 20 && (
              <Badge variant="muted" className="text-[10px]">
                +{result.notFound.length - 20} 更多
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
