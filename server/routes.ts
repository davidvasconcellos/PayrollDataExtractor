import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { processPDF, PDFSource } from "./pdf-extractor";
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
      const results = await processPDF(req.file.buffer, codesList, source as PDFSource);
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
      
      // Transform into a consolidated format
      const consolidatedData: PayrollResult[] = [];
      const uniqueDates = new Set<string>();
      const uniqueCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      
      // Collect all unique dates and codes with their descriptions
      payrollData.forEach(data => {
        uniqueDates.add(data.date);
        
        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          uniqueCodes.add(item.code);
          // Armazena descrição para cada código
          if (item.description) {
            codeDescriptions.set(item.code, item.description);
          }
        });
      });
      
      // Create consolidated results
      uniqueDates.forEach(date => {
        const result: PayrollResult = { date };
        
        // Initialize all codes with 0
        uniqueCodes.forEach(code => {
          result[code as string] = 0;
        });
        
        // Fill in actual values
        payrollData
          .filter(data => data.date === date)
          .forEach(data => {
            const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
            
            items.forEach(item => {
              result[item.code] = item.value;
            });
          });
        
        consolidatedData.push(result);
      });
      
      // Converte o Map de descrições para um objeto para enviar no JSON
      const codeInfo = Array.from(uniqueCodes).map(code => ({
        code,
        description: codeDescriptions.get(code as string) || code
      }));
      
      res.status(200).json({
        data: consolidatedData,
        codes: Array.from(uniqueCodes),
        codeInfo: codeInfo
      });
    } catch (error) {
      console.error("Error fetching payroll data:", error);
      res.status(500).json({ message: "Failed to fetch payroll data" });
    }
  });

  // Generate CSV export
  router.get("/export/csv", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      
      // Same consolidation logic as in the /payroll-data endpoint
      const uniqueDates = new Set<string>();
      const uniqueCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      
      payrollData.forEach(data => {
        uniqueDates.add(data.date);
        
        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          uniqueCodes.add(item.code);
          codeDescriptions.set(item.code, item.description);
        });
      });
      
      // Create CSV header
      let csv = "DATA";
      const codesArray = Array.from(uniqueCodes);
      
      codesArray.forEach(code => {
        const description = codeDescriptions.get(code) || code;
        csv += `;${description}`;
      });
      
      csv += "\n";
      
      // Create CSV rows
      uniqueDates.forEach(date => {
        let row = date;
        
        codesArray.forEach(code => {
          let value = 0;
          
          // Find data for this date and code
          payrollData
            .filter(data => data.date === date)
            .forEach(data => {
              const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
              const item = items.find(i => i.code === code);
              
              if (item) {
                value = item.value;
              }
            });
          
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
      
      // Same consolidation logic as in the /payroll-data endpoint
      const uniqueDates = new Set<string>();
      const uniqueCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      const consolidatedData: any[] = [];
      
      payrollData.forEach(data => {
        uniqueDates.add(data.date);
        
        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          uniqueCodes.add(item.code);
          codeDescriptions.set(item.code, item.description);
        });
      });
      
      // Create JSON rows
      uniqueDates.forEach(date => {
        const row: any = { date };
        
        uniqueCodes.forEach(code => {
          const description = codeDescriptions.get(code) || code;
          let value = 0;
          
          // Find data for this date and code
          payrollData
            .filter(data => data.date === date)
            .forEach(data => {
              const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
              const item = items.find(i => i.code === code);
              
              if (item) {
                value = item.value;
              }
            });
          
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
