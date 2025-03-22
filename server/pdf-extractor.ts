
import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import PDFParser from 'pdf2json';

export type PDFSource = 'ERP' | 'RH';

async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      const pages = pdfData.Pages.map(page => {
        const texts = page.Texts.map(text => decodeURIComponent(text.R[0].T));
        return texts.join(' ');
      });
      resolve(pages);
    });

    pdfParser.on("pdfParser_dataError", reject);
    pdfParser.parseBuffer(pdfBuffer);
  });
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function extractERPDate(text: string): string | null {
  const cleanedText = cleanText(text);
  console.log("Texto limpo para busca de data ERP:", cleanedText);
  
  const patterns = [
    /(?:Compet[êe]ncia|Data[\s-]*(?:de)?[\s-]*Refer[êe]ncia|Per[íi]odo)[\s:-]*(\d{2})[\s./]+(\d{4})/i,
    /\b(\d{2})[\s./]+(\d{4})\b/
  ];

  for (const pattern of patterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      console.log("Data ERP encontrada:", `${match[1]}/${match[2]}`);
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

function extractRHDate(text: string): string | null {
  const cleanedText = cleanText(text);
  console.log("Texto limpo para busca de data RH:", cleanedText);
  
  const months: { [key: string]: string } = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  const monthPattern = Object.keys(months).join('|');
  const pattern = new RegExp(`(${monthPattern}).*?[/\\s]+(\\d{4})`, 'i');
  
  const match = cleanedText.match(pattern);
  if (match) {
    const month = months[match[1].toLowerCase()];
    const year = match[2];
    console.log("Data RH encontrada:", `${month}/${year}`);
    return `${month}/${year}`;
  }
  return null;
}

function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const cleanedText = cleanText(text);
  console.log("Texto limpo para busca de verbas ERP:", cleanedText);
  
  const lines = cleanedText.split(/[\n\r]+/);
  const patterns = [
    /(\d{3,4})[.\s-]+([^0-9R$]+)[R$\s]*([\d,.]+)/i,
    /(\d{3,4})\s+([^0-9]+?)\s+([\d,.]+)/i
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const code = match[1].padStart(4, '0');
        if (codes.includes(code)) {
          const description = match[2].trim();
          const valueStr = match[3].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);

          if (!isNaN(value)) {
            console.log("Verba ERP encontrada:", { code, description, value });
            items.push({ code, description, value });
          }
        }
      }
    }
  }

  return items;
}

function extractRHItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const cleanedText = cleanText(text);
  console.log("Texto limpo para busca de verbas RH:", cleanedText);
  
  const lines = cleanedText.split(/[\n\r]+/);
  const patterns = [
    /(\d{3,4})[.\s-]+([^0-9R$]+)[R$\s]*([\d,.]+)/i,
    /(\d{3,4})\s+([^0-9]+?)\s+([\d,.]+)/i
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const code = match[1].padStart(4, '0');
        if (codes.includes(code)) {
          const description = match[2].trim();
          const valueStr = match[3].replace(/\./g, '').replace(',', '.');
          const value = parseFloat(valueStr);

          if (!isNaN(value)) {
            console.log("Verba RH encontrada:", { code, description, value });
            items.push({ code, description, value });
          }
        }
      }
    }
  }

  return items;
}

export async function processPDF(pdfBuffer: Buffer, codes: string[], source: PDFSource): Promise<ProcessedPayslip[]> {
  try {
    console.log("Iniciando processamento do PDF...");
    const pages = await extractTextFromPDF(pdfBuffer);
    console.log(`Número de páginas encontradas: ${pages.length}`);
    
    const results: ProcessedPayslip[] = [];

    for (const [index, pageText] of pages.entries()) {
      console.log(`Processando página ${index + 1}`);
      
      const date = source === 'ERP' ? 
        extractERPDate(pageText) : 
        extractRHDate(pageText);

      if (!date) {
        console.log(`Data não encontrada na página ${index + 1}`);
        continue;
      }

      const items = source === 'ERP' ?
        extractERPItems(pageText, codes) :
        extractRHItems(pageText, codes);

      console.log(`Itens encontrados na página ${index + 1}:`, items);

      if (items.length > 0) {
        results.push({ date, items, source });
      }
    }

    console.log("Resultados finais:", results);
    return results;
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    throw error;
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}
