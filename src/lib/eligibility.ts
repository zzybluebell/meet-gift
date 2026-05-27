// 资格规则引擎（MVP：单层 AND/OR + 5 字段）
// PRD §10 决策 4

import { Employee } from "@prisma/client";

export type Rule =
  | { type: "ALL" }
  | { type: "AND"; rules: Rule[] }
  | { type: "OR"; rules: Rule[] }
  | Condition;

export type Condition =
  | { field: "department"; op: "=" | "!=" | "in"; value: string | string[] }
  | { field: "gender"; op: "=" | "!="; value: "M" | "F" | "Other" }
  | { field: "buildingId"; op: "=" | "!=" | "in"; value: string | string[] }
  | { field: "hasChildren"; op: "="; value: boolean }
  | { field: "tenureYears"; op: ">=" | "<=" | "="; value: number }; // 司龄

export function evalRule(rule: Rule, emp: Employee): boolean {
  if ("type" in rule) {
    if (rule.type === "ALL") return true;
    if (rule.type === "AND") return rule.rules.every((r) => evalRule(r, emp));
    if (rule.type === "OR") return rule.rules.some((r) => evalRule(r, emp));
  }
  const cond = rule as Condition;
  if (cond.field === "tenureYears") {
    const years = Math.floor(
      (Date.now() - new Date(emp.hireDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    if (cond.op === ">=") return years >= cond.value;
    if (cond.op === "<=") return years <= cond.value;
    if (cond.op === "=") return years === cond.value;
  }
  const v = emp[cond.field as keyof Employee];
  if (cond.op === "=") return v === cond.value;
  if (cond.op === "!=") return v !== cond.value;
  if (cond.op === "in" && Array.isArray(cond.value)) return cond.value.includes(v as string);
  return false;
}

export function parseRule(raw: string): Rule {
  try {
    return JSON.parse(raw) as Rule;
  } catch {
    return { type: "ALL" };
  }
}

export function describeRule(rule: Rule): string {
  if ("type" in rule) {
    if (rule.type === "ALL") return "全员";
    if (rule.type === "AND")
      return rule.rules.map(describeRule).join(" 且 ");
    if (rule.type === "OR")
      return rule.rules.map(describeRule).join(" 或 ");
  }
  const cond = rule as Condition;
  const fieldNames: Record<string, string> = {
    department: "部门",
    gender: "性别",
    buildingId: "楼宇",
    hasChildren: "有孩子",
    tenureYears: "司龄",
  };
  const opNames: Record<string, string> = {
    "=": "=",
    "!=": "≠",
    in: "属于",
    ">=": "≥",
    "<=": "≤",
  };
  const valDisplay = Array.isArray(cond.value)
    ? `[${cond.value.join(", ")}]`
    : cond.field === "gender"
    ? ({ M: "男", F: "女", Other: "其他" } as Record<string, string>)[cond.value as string] || cond.value
    : cond.field === "hasChildren"
    ? cond.value
      ? "是"
      : "否"
    : String(cond.value);
  return `${fieldNames[cond.field] || cond.field} ${opNames[cond.op] || cond.op} ${valDisplay}`;
}
