
import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import XLSX from 'xlsx';
import { storage } from "./storage";
import multer from "multer";
import { processPDF as processERPPDF, PDFSource } from "./pdf-extractor";
import { processPDF as processRHPDF } from "./rh-extractor";
import { ExtractedPayrollItem, PayrollResult, ProcessedPayslip, User } from "@shared/schema";
import { z } from "zod";
import session from 'express-session';
import createMemoryStore from 'memorystore';

// Importa as definições de verbas e modelos
import {
  predefinedCodes,
  predefinedModels,
  getCodeByNumber,
  getModelByName
} from './payroll-definitions';

// Configuração do multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10 MB
  },
});

// Extensão dos tipos do Express para incluir sessão e usuário
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

// Função principal para registrar todas as rotas da aplicação
export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();
  const MemoryStore = createMemoryStore(session);

  // Configuração da sessão
  app.use(session({
    cookie: { maxAge: 86400000 }, // 24 horas
    store: new MemoryStore({
      checkPeriod: 86400000 // Limpa entradas expiradas a cada 24h
    }),
    secret: 'contracheque-secret-key',
    resave: false,
    saveUninitialized: false
  }));

  // Middleware de autenticação
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized - Please login" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.username !== 'dlinhares') {
        return res.status(401).json({ message: "Unauthorized - Invalid user" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: "Authentication error" });
    }
  };

  // Rotas de autenticação
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

    req.session.userId = user.id;

    return res.status(200).json({
      id: user.id,
      username: user.username
    });
  });

  // Rota de logout
  router.post("/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Rota para verificar autenticação
  router.get("/auth/check", requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json({
      id: req.user.id,
      username: req.user.username
    });
  });

  // Rotas de gerenciamento de templates
  router.get("/templates", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const templates = await storage.getTemplatesByUserId(req.user.id);
    res.status(200).json(templates);
  });

  // Modifica a rota de criação de template para suportar modelos pré-definidos
  router.post("/templates", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const templateSchema = z.object({
      name: z.string().min(1),
      codes: z.string().min(1),
      modelName: z.string().optional() // Nome do modelo pré-definido (opcional)
    });

    try {
      const { name, codes, modelName } = templateSchema.parse(req.body);

      // Se um modelo foi especificado, usa seus códigos
      let finalCodes = codes;
      if (modelName) {
        const model = getModelByName(modelName);
        if (model) {
          finalCodes = model.codes.join(',');
        }
      }

      const template = await storage.createTemplate({
        userId: req.user.id,
        name,
        codes: finalCodes
      });

      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });

  // Atualizar template existente
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

  // Excluir template
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

  // Rotas de grupos de códigos
  router.get("/code-groups", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);
    res.status(200).json(codeGroups);
  });

  // Criar novo grupo de códigos
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

  // Atualizar grupo de códigos
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

  // Excluir grupo de códigos
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

  // Rota para processar PDF
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

    // Validação da fonte
    if (source !== "ERP" && source !== "RH") {
      return res.status(400).json({ message: "Invalid source. Must be 'ERP' or 'RH'" });
    }

    // Processamento dos códigos
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

      // Processamento e salvamento dos resultados
      let successCount = 0;

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

      res.status(200).json(results[0] || { date: '', items: [], source });
    } catch (error) {
      console.error("PDF processing error:", error);
      console.log("PDF content sample:", req.file.buffer.toString('utf-8').substring(0, 1000));
      res.status(500).json({ message: "Failed to process PDF" });
    }
  });

  // Rota para obter dados consolidados da folha de pagamento
  router.get("/payroll-data", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);

      // Mapeamento de códigos para exibição
      const codeToDisplayMap = new Map<string, string>();
      
      // Primeiro, mapear códigos predefinidos
      predefinedCodes.forEach(pc => {
        const codes = pc.code.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code.trim(), pc.description);
        });
      });

      // Depois, mapear códigos de grupos personalizados
      codeGroups.forEach(group => {
        const codes = group.codes.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code.trim(), group.displayName);
        });
      });

      // Consolidação dos dados
      const consolidatedData: PayrollResult[] = [];
      const uniqueDates = new Set<string>();
      const uniqueDisplayCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();

      // Coleta de datas e códigos únicos
      payrollData.forEach(data => {
        uniqueDates.add(data.date);

        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          const displayName = codeToDisplayMap.get(item.code) || item.code;
          uniqueDisplayCodes.add(displayName);
          codeDescriptions.set(displayName, displayName);
        });
      });

      // Criação dos resultados consolidados
      uniqueDates.forEach(date => {
        const result: PayrollResult = { date };

        uniqueDisplayCodes.forEach(displayCode => {
          result[displayCode] = 0;
        });

        payrollData
          .filter(data => data.date === date)
          .forEach(data => {
            const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];

            items.forEach(item => {
              const displayCode = codeToDisplayMap.get(item.code) || item.code;
              if (typeof result[displayCode] === 'number') {
                result[displayCode] = (result[displayCode] as number) + item.value;
              } else {
                result[displayCode] = item.value;
              }
            });
          });

        consolidatedData.push(result);
      });

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

  // Rota para limpar dados da folha de pagamento
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

  // Rota para exportar XLSX
  router.get("/export/csv", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);

      // Mapeamento de códigos
      const codeToDisplayMap = new Map<string, string>();
      codeGroups.forEach(group => {
        const codes = group.codes.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code, group.displayName);
        });
      });

      // Preparação dos dados para CSV
      const uniqueDates = new Set<string>();
      const advantagesCodes = new Set<string>();
      const discountsCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      const consolidatedByDate = new Map<string, { advantages: Map<string, number>, discounts: Map<string, number> }>();

      payrollData.forEach(data => {
        uniqueDates.add(data.date);

        if (!consolidatedByDate.has(data.date)) {
          consolidatedByDate.set(data.date, {
            advantages: new Map<string, number>(),
            discounts: new Map<string, number>()
          });
        }

        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          const displayCode = codeToDisplayMap.get(item.code) || item.code;
          const isDiscount = predefinedCodes.find(pc => 
            pc.code.split(/[\s,]+/).some(c => c.trim() === item.code) && 
            pc.category === 'DESCONTOS'
          );

          if (isDiscount) {
            discountsCodes.add(displayCode);
          } else {
            advantagesCodes.add(displayCode);
          }

          if (item.description) {
            if (codeToDisplayMap.has(item.code)) {
              codeDescriptions.set(displayCode, displayCode);
            } else {
              codeDescriptions.set(displayCode, item.description);
            }
          }

          const dateValues = consolidatedByDate.get(data.date)!;
          const targetMap = isDiscount ? dateValues.discounts : dateValues.advantages;
          const currentValue = targetMap.get(displayCode) || 0;
          targetMap.set(displayCode, currentValue + item.value);
        });
      });

      // Função de formatação de moeda
      const formatCurrency = (value: number): string => {
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
      };

      // Organizar códigos por categoria
      const advantagesArray: string[] = [];
      const discountsArray: string[] = [];
      
      predefinedCodes.forEach(code => {
        const codes = code.code.split(/[\s,]+/).filter(Boolean);
        codes.forEach(c => {
          if (code.category === 'PROVENTOS') {
            advantagesArray.push(c.trim());
          } else if (code.category === 'DESCONTOS') {
            discountsArray.push(c.trim());
          }
        });
      });

      // Preparar dados para planilha de vantagens
      const advantagesData: any[] = [];
      
      // Mapear códigos para suas descrições predefinidas
      const advantageCodeMap = new Map<string, string>();
      predefinedCodes.forEach(code => {
        if (code.category === 'PROVENTOS') {
          code.code.split(/[,\s]+/).forEach(c => {
            advantageCodeMap.set(c.trim(), code.description);
          });
        }
      });

      // Criar cabeçalhos únicos baseados nos códigos predefinidos
      const uniqueAdvantages = Array.from(new Set(
        advantagesArray.map(code => {
          return advantageCodeMap.get(code) || code;
        })
      ));

      const advantagesHeaders = ['DATA', ...uniqueAdvantages, 'Total Vantagens'];
      advantagesData.push(advantagesHeaders);

      // Gerar linhas de dados
      uniqueDates.forEach(date => {
        const row = [date];
        const dateData = payrollData.filter(data => data.date === date);
        let totalAdvantages = 0;

        uniqueAdvantages.forEach(description => {
          let value = 0;
          dateData.forEach(data => {
            const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
            items.forEach(item => {
              if (advantageCodeMap.get(item.code) === description || 
                  (!advantageCodeMap.has(item.code) && item.code === description)) {
                value += item.value;
                totalAdvantages += item.value;
              }
            });
          });
          row.push(value);
        });
        row.push(totalAdvantages);
        advantagesData.push(row);
      });

      // Preparar dados para planilha de descontos
      const discountsData: any[] = [];
      
      // Mapear códigos para suas descrições predefinidas
      const discountCodeMap = new Map<string, string>();
      predefinedCodes.forEach(code => {
        if (code.category === 'DESCONTOS') {
          code.code.split(/[,\s]+/).forEach(c => {
            discountCodeMap.set(c.trim(), code.description);
          });
        }
      });

      // Criar cabeçalhos únicos baseados nos códigos predefinidos
      const uniqueDiscounts = Array.from(new Set(
        discountsArray.map(code => {
          return discountCodeMap.get(code) || code;
        })
      ));

      const discountsHeaders = ['DATA', ...uniqueDiscounts, 'Total Descontos'];
      discountsData.push(discountsHeaders);

      // Gerar linhas de dados
      uniqueDates.forEach(date => {
        const row = [date];
        const dateData = payrollData.filter(data => data.date === date);
        let totalDiscounts = 0;

        uniqueDiscounts.forEach(description => {
          let value = 0;
          dateData.forEach(data => {
            const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
            items.forEach(item => {
              if (discountCodeMap.get(item.code) === description || 
                  (!discountCodeMap.has(item.code) && item.code === description)) {
                value += item.value;
                totalDiscounts += item.value;
              }
            });
          });
          row.push(value);
        });
        row.push(totalDiscounts);
        discountsData.push(row);
      });

      // Criar workbook com duas planilhas
      const wb = XLSX.utils.book_new();
      
      const wsVantagens = XLSX.utils.aoa_to_sheet(advantagesData);
      const wsDescontos = XLSX.utils.aoa_to_sheet(discountsData);

      // Ajustar formato das células para moeda
      const range = XLSX.utils.decode_range(wsVantagens['!ref']);
      for(let R = 1; R <= range.e.r; ++R) {
        for(let C = 1; C <= range.e.c; ++C) {
          const cell = XLSX.utils.encode_cell({r: R, c: C});
          if(wsVantagens[cell]) {
            wsVantagens[cell].z = '#,##0.00';
          }
        }
      }

      const rangeDesc = XLSX.utils.decode_range(wsDescontos['!ref']);
      for(let R = 1; R <= rangeDesc.e.r; ++R) {
        for(let C = 1; C <= rangeDesc.e.c; ++C) {
          const cell = XLSX.utils.encode_cell({r: R, c: C});
          if(wsDescontos[cell]) {
            wsDescontos[cell].z = '#,##0.00';
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, wsVantagens, "VANTAGENS");
      XLSX.utils.book_append_sheet(wb, wsDescontos, "DESCONTOS");

      // Gerar buffer do arquivo XLSX
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=contracheques.xlsx");
      res.status(200).send(buf);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export data as CSV" });
    }
  });

  // Rota para exportar JSON
  router.get("/export/json", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const payrollData = await storage.getPayrollDataByUserId(req.user.id);
      const codeGroups = await storage.getCodeGroupsByUserId(req.user.id);

      // Mapeamento de códigos
      const codeToDisplayMap = new Map<string, string>();
      codeGroups.forEach(group => {
        const codes = group.codes.split(/[\s,]+/).filter(Boolean);
        codes.forEach(code => {
          codeToDisplayMap.set(code, group.displayName);
        });
      });

      // Preparação dos dados para JSON
      const uniqueDates = new Set<string>();
      const uniqueDisplayCodes = new Set<string>();
      const codeDescriptions = new Map<string, string>();
      const consolidatedByDate = new Map<string, Map<string, number>>();
      const consolidatedData: any[] = [];

      payrollData.forEach(data => {
        uniqueDates.add(data.date);

        if (!consolidatedByDate.has(data.date)) {
          consolidatedByDate.set(data.date, new Map<string, number>());
        }

        const items = JSON.parse(data.codeData as string) as ExtractedPayrollItem[];
        items.forEach(item => {
          const displayCode = codeToDisplayMap.get(item.code) || item.code;
          uniqueDisplayCodes.add(displayCode);

          if (item.description) {
            if (codeToDisplayMap.has(item.code)) {
              codeDescriptions.set(displayCode, displayCode);
            } else {
              codeDescriptions.set(displayCode, item.description);
            }
          }
        });
      });

      // Geração do JSON
      uniqueDates.forEach(date => {
        const row: any = { date };

        const dateItems = payrollData
          .filter(data => data.date === date)
          .flatMap(data => JSON.parse(data.codeData as string) as ExtractedPayrollItem[]);

        dateItems.forEach(item => {
          const displayCode = codeToDisplayMap.get(item.code) || item.code;
          const formattedValue = `R$ ${item.value.toFixed(2).replace('.', ',')}`;
          row[item.description] = formattedValue;
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


  // Adiciona novas rotas para verbas e modelos pré-definidos
  router.get("/predefined-codes", requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json(predefinedCodes);
  });

  router.get("/predefined-models", requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json(predefinedModels);
  });

  router.get("/predefined-codes/:code", requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const code = getCodeByNumber(req.params.code);
    if (!code) {
      return res.status(404).json({ message: "Code not found" });
    }
    res.status(200).json(code);
  });

  router.get("/predefined-models/:name", requireAuth, (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const model = getModelByName(req.params.name);
    if (!model) {
      return res.status(404).json({ message: "Model not found" });
    }
    res.status(200).json(model);
  });

  // Registra todas as rotas com prefixo /api
  app.use("/api", router);

  const httpServer = createServer(app);
  return httpServer;
}
