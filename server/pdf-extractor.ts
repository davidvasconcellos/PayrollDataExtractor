
import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'pdfjs-dist/legacy/build/pdf.worker.entry';

// Define os tipos de fontes possíveis do PDF
export type PDFSource = 'ERP' | 'RH';

// Interface representando uma página extraída do PDF
interface PDFPage {
  text: string;
  pageNumber: number;
}

// Função assíncrona para extrair texto de um PDF
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFPage[]> {
  console.log("Iniciando extração do PDF...");

  try {
    // Carrega o PDF usando pdf.js
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    const pages: PDFPage[] = [];
    
    // Extrai texto de cada página
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Concatena todo o texto da página
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({
        text,
        pageNumber: i
      });

      console.log(`Página ${i} extraída com ${text.length} caracteres`);
    }

    return pages;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    throw error;
  }
}

// Função para extrair a data no formato esperado a partir de um texto ERP
function extractERPDate(text: string): string | null {
  const patterns = [
    /(?:Compet[êe]ncia|Per[íi]odo|Data[^:]*?):\s*(\d{2})[\/\s-](\d{4})/i,
    /(\d{2})[\/\s-](\d{4})/
  ];

  // Tenta encontrar uma data usando os padrões definidos
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

// Função para extrair a data de um texto RH baseado em nomes de meses
// function extractRHDate(text: string): string | null {
//   // Mapeamento de nomes de meses para números
//   const monthMap: { [key: string]: string } = {
//     'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
//     'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
//     'agosto': '08', 'setembro': '09', 'outubro': '10',
//     'novembro': '11', 'dezembro': '12'
//   };

//   const monthPattern = Object.keys(monthMap).join('|');
//   const pattern = new RegExp(`(${monthPattern})[\/\\s]*de[\\s]*?(\\d{4})`, 'i');

//   const match = text.match(pattern);
//   if (match) {
//     const month = monthMap[match[1].toLowerCase()];
//     return `${month}/${match[2]}`;
//   }
//   return null;
// }

// Função para extrair itens de folha de pagamento de textos ERP
function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const code of codes) {
    for (const line of lines) {
      // Padrão para encontrar códigos e valores
      const pattern = new RegExp(`\\b${code}\\b\\s*[-.]?\\s*([^\\n\\r]*?)\\s+R?\\$?\\s*(\\d+(?:[.,]\\d{3})*(?:[.,]\\d{2}))`, 'i');
      const match = line.match(pattern);

      if (match) {
        const description = match[1].trim();
        // Converte valor para formato numérico
        const valueStr = match[2].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);

        console.log(`Extraindo código ${code}: valor original="${match[2]}", convertido="${valueStr}", final=${value}`);

        if (!isNaN(value) && description) {
          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
        }
      }
    }
  }

  return items;
}

// Função para extrair itens de folha de pagamento de textos RH
// function extractRHItems(text: string, codes: string[]): ExtractedPayrollItem[] {
//   const items: ExtractedPayrollItem[] = [];
//   const lines = text.split(/[\n\r]+/);

//   for (const code of codes) {
//     for (const line of lines) {
//       // Padrão específico para formato RH
//       const pattern = new RegExp(`\\b${code}\\b[\\s.]+([^\\n\\r]+?)\\s+R?\\$?\\s*(\\d+(?:[.,]\\d{3})*(?:[.,]\\d{2}))`, 'i');
//       const match = line.match(pattern);

//       if (match) {
//         const description = match[1].trim();
//         const valueStr = match[2].replace(/\./g, '').replace(',', '.');
//         const value = parseFloat(valueStr);

//         console.log(`Extraindo código ${code}: valor original="${match[2]}", convertido="${valueStr}", final=${value}`);

//         if (!isNaN(value) && description) {
//           const existingItem = items.find(item => item.code === code);
//           if (existingItem) {
//             existingItem.value += value;
//           } else {
//             items.push({ code, description, value });
//           }
//         }
//       }
//     }
//   }

//   return items;
// }

// Função auxiliar para extrair data baseada na fonte do PDF
export function extractDate(text: string, source: PDFSource): string | null {
  return source === 'ERP' ? extractERPDate(text) : extractRHDate(text);
}

// Funções exportadas para extração de itens baseadas na fonte
export function extractERPPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  return extractERPItems(text, codes);
}

// export function extractRHPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
//   return extractRHItems(text, codes);
// }

// Função principal para processar o PDF
export async function processPDF(
  pdfBuffer: Buffer, 
  codes: string[], 
  source: PDFSource
): Promise<ProcessedPayslip[]> {
  try {
    console.log(`Processando PDF de fonte ${source}`, codes);

    // Extrai texto de todas as páginas
    const pages = await extractTextFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    // Processa cada página individualmente
    for (const page of pages) {
      console.log(`Processando página ${page.pageNumber}`);

      // Extrai a data da página
      const date = extractDate(page.text, source);
      if (!date) {
        console.log(`Data não encontrada na página ${page.pageNumber}`);
        continue;
      }
      console.log('Data extraída:', date);

      // Extrai itens baseado na fonte do PDF
      const items = source === 'ERP' 
        ? extractERPPayrollItems(page.text, codes);
        // : extractRHPayrollItems(page.text, codes);

      console.log(`Encontrados ${items.length} itens na página ${page.pageNumber}`);

      if (items.length > 0) {
        results.push({ date, items, source });
      }
    }

    console.log(`Processamento finalizado. Encontrados ${results.length} conjuntos de dados.`);
    return results;
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    throw error;
  }
}

// Função auxiliar para formatar valores monetários
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}
