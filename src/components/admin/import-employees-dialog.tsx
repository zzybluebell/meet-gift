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
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "strict" | "skip" | "overwrite";

type ImportResult = {
  ok: boolean;
  totalRows: number;
  created: number;
  skipped: number;
  overwritten: number;
  errors: { row: number; employeeNo: string; reason: string }[];
  mode: Mode;
  error?: string;
};

const MODES: { value: Mode; title: string; desc: string }[] = [
  { value: "skip", title: "跳过", desc: "工号重复则跳过，不影响其它行（默认）" },
  { value: "overwrite", title: "覆盖", desc: "工号重复则用 Excel 里的新数据覆盖" },
  { value: "strict", title: "严格", desc: "任何重复或格式错都整体回滚，不导入" },
];

export function ImportEmployeesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("skip");
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
    const res = await fetch("/api/employees/import", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setResult({ ok: false, ...data });
    } else {
      setResult(data);
      router.refresh();
    }
    setSubmitting(false);
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
        <Button variant="outline">
          <Upload className="w-4 h-4" />
          批量导入
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入员工档案</DialogTitle>
          <DialogDescription>
            上传 Excel 文件，按列名识别字段。第一次使用建议先下载模板
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* 下载模板 */}
            <a
              href="/samples/employees-import-sample.xlsx"
              download
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="w-4 h-4" />
              下载 Excel 导入模板（带示例数据）
            </a>

            {/* 模式 */}
            <div>
              <div className="text-sm font-medium mb-2">工号冲突处理</div>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left text-sm transition-all",
                      mode === m.value ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                    )}
                  >
                    <div className={cn("font-medium", m.value === "strict" && "text-warning")}>{m.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-snug">{m.desc}</div>
                  </button>
                ))}
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
              <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                💡 列名兼容「工号 / employeeNo」、「姓名 / name」等。第一个 sheet 优先。
                日期格式 YYYY-MM-DD。性别 M/F/Other 或 男/女。角色 employee/admin/verifier。
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
  if (!result.ok && result.error) {
    return (
      <div className="rounded-lg bg-destructive/10 text-destructive p-4 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">导入失败</div>
          <div className="text-sm mt-1">{result.error}</div>
        </div>
      </div>
    );
  }

  const totalSuccess = result.created + result.overwritten;
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-lg p-4 flex items-start gap-2",
          totalSuccess > 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        )}
      >
        {totalSuccess > 0 ? (
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        )}
        <div>
          <div className="font-medium">
            {totalSuccess > 0 ? "导入完成" : "没有任何行被导入"}
          </div>
          <div className="text-sm mt-1">
            读取 {result.totalRows} 行 · 新建 <strong>{result.created}</strong>
            {result.overwritten > 0 && <> · 覆盖 <strong>{result.overwritten}</strong></>}
            {result.skipped > 0 && <> · 跳过 <strong>{result.skipped}</strong></>}
            {result.errors.length > 0 && <> · 错误 <strong>{result.errors.length}</strong></>}
            {" "}（{result.mode === "strict" ? "严格" : result.mode === "skip" ? "跳过" : "覆盖"} 模式）
          </div>
          {result.mode === "strict" && result.errors.length > 0 && (
            <div className="text-xs mt-2 opacity-80">
              ⚠️ 严格模式下有错误，所有行都已回滚未写入。修好错误再试。
            </div>
          )}
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-lg bg-warning/10 p-3 max-h-80 overflow-y-auto">
          <div className="text-sm font-medium text-warning mb-2 flex items-center gap-1.5 sticky top-0 bg-warning/5 -mx-3 px-3 py-1 backdrop-blur">
            <AlertTriangle className="w-4 h-4" />
            错误清单（共 {result.errors.length} 条）
          </div>
          <div className="space-y-1.5">
            {result.errors.slice(0, 50).map((err, i) => (
              <div key={i} className="text-xs flex items-start gap-2 leading-relaxed">
                <Badge variant="warning" className="font-mono shrink-0 mt-0.5">
                  第 {err.row} 行
                </Badge>
                {err.employeeNo && (
                  <Badge variant="muted" className="font-mono shrink-0 mt-0.5">
                    {err.employeeNo}
                  </Badge>
                )}
                <span className="text-foreground">{err.reason}</span>
              </div>
            ))}
            {result.errors.length > 50 && (
              <div className="text-xs text-muted-foreground pt-1">
                + 还有 {result.errors.length - 50} 条错误未显示
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
