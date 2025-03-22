import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  codes: text("codes").notNull(),
});

export const payrollData = pgTable("payroll_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  source: text("source").notNull(), // "ERP" or "RH"
  codeData: jsonb("code_data").notNull(), // Store code, description, and value
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTemplateSchema = createInsertSchema(templates).pick({
  userId: true,
  name: true,
  codes: true,
});

export const insertPayrollDataSchema = createInsertSchema(payrollData).pick({
  userId: true,
  date: true,
  source: true,
  codeData: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

export type InsertPayrollData = z.infer<typeof insertPayrollDataSchema>;
export type PayrollData = typeof payrollData.$inferSelect;

// Custom types for the application
export interface ExtractedPayrollItem {
  code: string;
  description: string;
  value: number;
}

export interface ProcessedPayslip {
  date: string;
  items: ExtractedPayrollItem[];
  source: string;
}

export interface PayrollResult {
  date: string;
  [code: string]: string | number;
}
