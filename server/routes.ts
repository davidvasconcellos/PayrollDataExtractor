import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { processPDF as processERPPDF, PDFSource } from "./pdf-extractor";
import { processPDF as processRHPDF } from "./rh-extractor";
import { ExtractedPayrollItem, PayrollResult, ProcessedPayslip, User } from "@shared/schema";
import { z } from "zod";
import session from 'express-session';
import createMemoryStore from 'memorystore';

// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Extend Express Request type
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();
  const MemoryStore = createMemoryStore(session);

  // Configure session
  app.use(session({
    cookie: { maxAge: 86400000 }, // 24 hours
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: 'contracheque-secret-key',
    resave: false,
    saveUninitialized: false
  }));

  // Auth middleware
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        // Create default user if none exists
        const defaultUser = await storage.createUser({
          username: 'default',
          password: 'default'
        });
        req.session.userId = defaultUser.id;
        req.user = defaultUser;
        return next();
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        // Create default user if none exists
        const defaultUser = await storage.createUser({
          username: 'default',
          password: 'default'
        });
        req.session.userId = defaultUser.id;
        req.user = defaultUser;
        return next();
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      next();
    }
  };

  // Authentication routes
  router.post("/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        message: "Username and password are required" 
      });
    }
    
    const user = await storage.getUserByUsername(username);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ 
        message: "Invalid credentials" 
      });
    }
    
    // Set user ID in session
    req.session.userId = user.id;
    
    return res.status(200).json({ 
      id: user.id, 
      username: user.username 
    });
  });
  
  router.post("/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  router.get("/auth/check", requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    return res.status(200).json({ 
      id: req.user.id, 
      username: req.user.username 
    });
  });

  // Template management routes
  router.get("/templates", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const templates = await storage.getTemplatesByUserId(req.user.id);
    res.status(200).json(templates);
  });
  
  router.post("/templates", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const templateSchema = z.object({
      name: z.string().min(1),
      codes: z.string().min(1)
    });

    try {
      const { name, codes } = templateSchema.parse(req.body);
      
      const template = await storage.createTemplate({
        userId: req.user.id,
        name,
        codes
      });
      
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });
  
  router.put("/templates/:id", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    const templateSchema = z.object({
      name: z.string().min(1).optional(),
      codes: z.string().min(1).optional()
    });

    try {
      const data = templateSchema.parse(req.body);
      
      const template = await storage.getTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updatedTemplate = await storage.updateTemplate(id, data);
      res.status(200).json(updatedTemplate);
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });
  
  router.delete("/templates/:id", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    const template = await storage.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    
    if (template.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteTemplate(id);
    res.status(200).json({ message: "Template deleted successfully" });
  });
  
  // Code Group routes
  router.get("/code-groups", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);
    res.status(200).json(codeGroups);
  });
  
  router.post("/code-groups", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const codeGroupSchema = z.object({
      displayName: z.string().min(1),
      codes: z.string().min(1)
    });
    
    try {
      const { displayName, codes } = codeGroupSchema.parse(req.body);
      
      const codeGroup = await storage.createCodeGroup({
        userId: req.user.id,
        displayName,
        codes
      });
      
      res.status(201).json(codeGroup);
    } catch (error) {
      res.status(400).json({ message: "Invalid code group data" });
    }
  });
  
  router.put("/code-groups/:id", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    const codeGroupSchema = z.object({
      displayName: z.string().min(1).optional(),
      codes: z.string().min(1).optional()
    });
    
    try {
      const data = codeGroupSchema.parse(req.body);
      
      const codeGroup = await storage.getCodeGroupById(id);
      
      if (!codeGroup) {
        return res.status(404).json({ message: "Code group not found" });
      }
      
      if (codeGroup.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updatedCodeGroup = await storage.updateCodeGroup(id, data);
      res.status(200).json(updatedCodeGroup);
    } catch (error) {
      res.status(400).json({ message: "Invalid code group data" });
    }
  });
  
  router.delete("/code-groups/:id", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = parseInt(req.params.id);
    const codeGroup = await storage.getCodeGroupById(id);
    
    if (!codeGroup) {
      return res.status(404).json({ message: "Code group not found" });
    }
    
    if (codeGroup.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteCodeGroup(id);
    res.status(200).json({ message: "Code group deleted successfully" });
  });

  // PDF processing routes
  router.post("/process-pdf", requireAuth, upload.single("pdf"), async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const { source, codes } = req.body;
    
    if (!source || !codes) {
      return res.status(400).json({ message: "Source and codes are required" });
    }
    
    // Validate source
    if (source !== "ERP" && source !== "RH") {
      return res.status(400).json({ message: "Invalid source. Must be 'ERP' or 'RH'" });
    }
    
    // Parse codes
    console.log('Códigos recebidos:', codes);
    const codesList = (codes as string).split(/[\s,]+/).filter(Boolean);
    console.log('Códigos processados:', codesList);
    
    if (codesList.length === 0) {
      return res.status(400).json({ message: "No valid codes provided" });
    }
    
    try {
      console.log('Processando PDF com códigos:', codesList);
      const results = source === 'ERP' 
        ? await processERPPDF(req.file.buffer, codesList, source as PDFSource)
        : await processRHPDF(req.file.buffer, codesList);
      console.log('Resultado do processamento (múltiplas páginas):', JSON.stringify(results, null, 2));
      
      // Processar e salvar cada resultado (uma página do PDF)
      let successCount = 0;
      
      // Salvar cada resultado separadamente
      for (const result of results) {
        if (result.date && result.items.length > 0) {
          console.log(`Salvando dados processados da data ${result.date} na base`);
          await storage.createPayrollData({
            userId: req.user.id,
            date: result.date,
            source,
            codeData: JSON.stringify(result.items)
          });
          successCount++;
        } else {
          console.log(`Nenhum item encontrado ou data inválida para um dos resultados`);
        }
      }
      
      if (successCount === 0) {
        console.log('Não foi possível extrair nenhum dado válido do PDF');
      } else {
        console.log(`${successCount} páginas do PDF foram processadas com sucesso`);
      }
      
      // Retorna todos os resultados processados
      res.status(200).json(results[0] || { date: '', items: [], source });
    } catch (error) {
      console.error("PDF processing error:", error);
      console.log("PDF content sample:", req.file.buffer.toString('utf-8').substring(0, 1000));
      res.status(500).json({ message: "Failed to process PDF" });
    }
  });

  // Get consolidated payroll data
  router.get("/payroll-data", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      
      // Buscar grupos de código do usuário
      const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);
      
      // Criar mapeamento de código para seu grupo exibido
      const codeToDisplayMap = new Map<string, string>();
      codeGroups.forEach(group => {
        const codes = group.codes.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code, group.displayName);
        });
      });
      
      // Transform into a consolidated format
      const consolidatedData: PayrollResult[] = [];
      const uniqueDates = new Set<string>();
      const uniqueDisplayCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      
      // Collect all unique dates and codes with their descriptions
      payrollData.forEach(data => {
        uniqueDates.add(data.date);
        
        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          // Verifica se o código tem um mapeamento de exibição
          const displayCode = codeToDisplayMap.get(item.code) || item.code;
          uniqueDisplayCodes.add(displayCode);
          
          // Armazena descrição para cada código de exibição
          if (item.description) {
            // Se o código for mapeado, usamos o nome do grupo como descrição
            if (codeToDisplayMap.has(item.code)) {
              codeDescriptions.set(displayCode, displayCode);
            } else {
              codeDescriptions.set(displayCode, item.description);
            }
          }
        });
      });
      
      // Create consolidated results
      uniqueDates.forEach(date => {
        const result: PayrollResult = { date };
        
        // Initialize all display codes with 0
        uniqueDisplayCodes.forEach(displayCode => {
          result[displayCode] = 0;
        });
        
        // Fill in actual values, agrupando por código de exibição
        payrollData
          .filter(data => data.date === date)
          .forEach(data => {
            const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
            
            items.forEach(item => {
              const displayCode = codeToDisplayMap.get(item.code) || item.code;
              // Soma valores para códigos agrupados
              result[displayCode] = (result[displayCode] as number) + item.value;
            });
          });
        
        consolidatedData.push(result);
      });
      
      // Converte o Map de descrições para um objeto para enviar no JSON
      const codeInfo = Array.from(uniqueDisplayCodes).map(displayCode => ({
        code: displayCode,
        description: codeDescriptions.get(displayCode) || displayCode
      }));
      
      res.status(200).json({
        data: consolidatedData,
        codes: Array.from(uniqueDisplayCodes),
        codeInfo: codeInfo
      });
    } catch (error) {
      console.error("Error fetching payroll data:", error);
      res.status(500).json({ message: "Failed to fetch payroll data" });
    }
  });
  
  // Clear all payroll data for current user
  router.post("/payroll-data/clear", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const deleted = await storage.clearPayrollDataByUserId(req.user.id);
      
      if (deleted) {
        res.status(200).json({ message: "All payroll data cleared successfully" });
      } else {
        res.status(500).json({ message: "Failed to clear some payroll data" });
      }
    } catch (error) {
      console.error("Error clearing payroll data:", error);
      res.status(500).json({ message: "Failed to clear payroll data" });
    }
  });

  // Generate CSV export
  router.get("/export/csv", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      
      // Buscar grupos de código do usuário
      const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);
      
      // Criar mapeamento de código para seu grupo exibido
      const codeToDisplayMap = new Map<string, string>();
      codeGroups.forEach(group => {
        const codes = group.codes.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code, group.displayName);
        });
      });
      
      // Transform into a consolidated format
      const uniqueDates = new Set<string>();
      const uniqueDisplayCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      const consolidatedByDate = new Map<string, Map<string, number>>();
      
      // Collect all unique dates and codes with their descriptions
      payrollData.forEach(data => {
        uniqueDates.add(data.date);
        
        // Inicializar mapa para esta data se não existir
        if (!consolidatedByDate.has(data.date)) {
          consolidatedByDate.set(data.date, new Map<string, number>());
        }
        
        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          // Verifica se o código tem um mapeamento de exibição
          const displayCode = codeToDisplayMap.get(item.code) || item.code;
          uniqueDisplayCodes.add(displayCode);
          
          // Armazena descrição para cada código de exibição
          if (item.description) {
            // Se o código for mapeado, usamos o nome do grupo como descrição
            if (codeToDisplayMap.has(item.code)) {
              codeDescriptions.set(displayCode, displayCode);
            } else {
              codeDescriptions.set(displayCode, item.description);
            }
          }
          
          // Soma valores agrupados para cada data
          const dateValues = consolidatedByDate.get(data.date)!;
          const currentValue = dateValues.get(displayCode) || 0;
          dateValues.set(displayCode, currentValue + item.value);
        });
      });
      
      // Create CSV header
      let csv = "DATA";
      const displayCodesArray = Array.from(uniqueDisplayCodes);
      
      displayCodesArray.forEach(displayCode => {
        const description = codeDescriptions.get(displayCode) || displayCode;
        csv += `;${description}`;
      });
      
      csv += "\n";
      
      // Create CSV rows
      uniqueDates.forEach(date => {
        let row = date;
        const dateValues = consolidatedByDate.get(date)!;
        
        displayCodesArray.forEach(displayCode => {
          const value = dateValues.get(displayCode) || 0;
          
          // Format value as currency (R$ X.XXX,XX)
          const formattedValue = `R$ ${value.toFixed(2).replace('.', ',')}`;
          row += `;${formattedValue}`;
        });
        
        csv += row + "\n";
      });
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=contracheques.csv");
      res.status(200).send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export data as CSV" });
    }
  });

  // Generate JSON export
  router.get("/export/json", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      
      // Buscar grupos de código do usuário
      const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);
      
      // Criar mapeamento de código para seu grupo exibido
      const codeToDisplayMap = new Map<string, string>();
      codeGroups.forEach(group => {
        const codes = group.codes.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code, group.displayName);
        });
      });
      
      // Transform into a consolidated format
      const uniqueDates = new Set<string>();
      const uniqueDisplayCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      const consolidatedByDate = new Map<string, Map<string, number>>();
      const consolidatedData: any[] = [];
      
      // Collect all unique dates and codes with their descriptions
      payrollData.forEach(data => {
        uniqueDates.add(data.date);
        
        // Inicializar mapa para esta data se não existir
        if (!consolidatedByDate.has(data.date)) {
          consolidatedByDate.set(data.date, new Map<string, number>());
        }
        
        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          // Verifica se o código tem um mapeamento de exibição
          const displayCode = codeToDisplayMap.get(item.code) || item.code;
          uniqueDisplayCodes.add(displayCode);
          
          // Armazena descrição para cada código de exibição
          if (item.description) {
            // Se o código for mapeado, usamos o nome do grupo como descrição
            if (codeToDisplayMap.has(item.code)) {
              codeDescriptions.set(displayCode, displayCode);
            } else {
              codeDescriptions.set(displayCode, item.description);
            }
          }
          
          // Soma valores agrupados para cada data
          const dateValues = consolidatedByDate.get(data.date)!;
          const currentValue = dateValues.get(displayCode) || 0;
          dateValues.set(displayCode, currentValue + item.value);
        });
      });
      
      // Create JSON rows
      uniqueDates.forEach(date => {
        const row: any = { date };
        const dateValues = consolidatedByDate.get(date)!;
        
        uniqueDisplayCodes.forEach(displayCode => {
          const description = codeDescriptions.get(displayCode) || displayCode;
          const value = dateValues.get(displayCode) || 0;
          
          // Format value as currency (R$ X.XXX,XX)
          const formattedValue = `R$ ${value.toFixed(2).replace('.', ',')}`;
          row[description] = formattedValue;
        });
        
        consolidatedData.push(row);
      });
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=contracheques.json");
      res.status(200).json(consolidatedData);
    } catch (error) {
      console.error("Error exporting JSON:", error);
      res.status(500).json({ message: "Failed to export data as JSON" });
    }
  });

  // Register all routes with /api prefix
  app.use("/api", router);

  const httpServer = createServer(app);
  return httpServer;
}
