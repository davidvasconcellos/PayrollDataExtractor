import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import PDFParser from 'pdf2json';

export type PDFSource = 'ERP' | 'RH';

async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      const pages = pdfData.Pages.map(page => {
        return page.Texts.map(text => decodeURIComponent(text.R[0].T)).join(' ');
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
  const datePattern = /Data\s*de\s*Refer[êe]ncia:\s*(\d{2})\/(\d{4})/i;
  const match = text.match(datePattern);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return null;
}

function extractRHDate(text: string): string | null {
  const monthNames = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  const pattern = /(?:AVISO\s+DE\s+CRÉDITO\s+)?([A-Za-zç]+)\/(\d{4})/i;
  const match = text.match(pattern);

  if (match) {
    const month = monthNames[match[1].toLowerCase()];
    if (month) {
      return `${month}/${match[2]}`;
    }
  }
  return null;
}

function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  const pattern = /(\d{4})\s+([\w\s.-]+?)\s+R\$\s*([\d.,]+)/i;

  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      const code = match[1];
      if (codes.includes(code)) {
        const description = match[2].trim();
        const value = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));

        if (!isNaN(value)) {
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

function extractRHItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  const pattern = /(\d{4})\s*([^0-9\n]+?)\s+(?:\d+\.\d{2}\s+)?(?:\d{2}\.\d{4}\s+)?(\d+[\d,.]+)/;

  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      const code = match[1];
      if (codes.includes(code)) {
        const description = match[2].trim();
        const value = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));

        if (!isNaN(value)) {
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

export async function processPDF(pdfBuffer: Buffer, codes: string[], source: PDFSource): Promise<ProcessedPayslip[]> {
  try {
    const pages = await extractTextFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    for (const pageText of pages) {
      const date = source === 'ERP' ? 
        extractERPDate(pageText) : 
        extractRHDate(pageText);

      if (!date) continue;

      const items = source === 'ERP' ?
        extractERPItems(pageText, codes) :
        extractRHItems(pageText, codes);

      if (items.length > 0) {
        results.push({ date, items, source });
      }
    }

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