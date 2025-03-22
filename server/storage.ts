import { 
  users, 
  templates, 
  payrollData,
  type User, 
  type InsertUser, 
  type Template, 
  type InsertTemplate,
  type PayrollData,
  type InsertPayrollData
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Template operations
  getTemplatesByUserId(userId: number): Promise<Template[]>;
  getTemplateById(id: number): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: number): Promise<boolean>;
  
  // Payroll data operations
  getPayrollDataByUserId(userId: number): Promise<PayrollData[]>;
  createPayrollData(data: InsertPayrollData): Promise<PayrollData>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private templates: Map<number, Template>;
  private payrollData: Map<number, PayrollData>;
  private currentUserId: number;
  private currentTemplateId: number;
  private currentPayrollId: number;

  constructor() {
    this.users = new Map();
    this.templates = new Map();
    this.payrollData = new Map();
    this.currentUserId = 1;
    this.currentTemplateId = 1;
    this.currentPayrollId = 1;
    
    // Add default user for the application
    this.createUser({ 
      username: "dlinhares", 
      password: "123456" 
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Template operations
  async getTemplatesByUserId(userId: number): Promise<Template[]> {
    return Array.from(this.templates.values()).filter(
      (template) => template.userId === userId
    );
  }

  async getTemplateById(id: number): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = this.currentTemplateId++;
    const template: Template = { ...insertTemplate, id };
    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const template = this.templates.get(id);
    if (!template) return undefined;
    
    const updatedTemplate: Template = { ...template, ...data };
    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteTemplate(id: number): Promise<boolean> {
    return this.templates.delete(id);
  }

  // Payroll data operations
  async getPayrollDataByUserId(userId: number): Promise<PayrollData[]> {
    return Array.from(this.payrollData.values()).filter(
      (data) => data.userId === userId
    );
  }

  async createPayrollData(insertData: InsertPayrollData): Promise<PayrollData> {
    const id = this.currentPayrollId++;
    const data: PayrollData = { ...insertData, id };
    this.payrollData.set(id, data);
    return data;
  }
}

export const storage = new MemStorage();
