import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import PDFParser from 'pdf2json';

export type PDFSource = 'ERP' | 'RH';

async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      const pages = pdfData.Pages.map(page => 
        page.Texts.map(text => decodeURIComponent(text.R[0].T)).join(' ')
      );
      resolve(pages);
    });

    pdfParser.on("pdfParser_dataError", reject);
    pdfParser.parseBuffer(pdfBuffer);
  });
}

function extractERPDate(text: string): string | null {
  const patterns = [
    /Compet[êe]ncia:?\s*(\d{2})\/(\d{4})/i,
    /Data\s*de\s*Refer[êe]ncia:?\s*(\d{2})\/(\d{4})/i,
    /Per[íi]odo:?\s*(\d{2})\/(\d{4})/i,
    /\b(\d{2})\/(\d{4})\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

function extractRHDate(text: string): string | null {
  const months = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  const pattern = new RegExp(`(${Object.keys(months).join('|')}).*?\\s*(\\d{4})`, 'i');
  const match = text.match(pattern);

  if (match) {
    const month = months[match[1].toLowerCase()];
    const year = match[2];
    return `${month}/${year}`;
  }
  return null;
}

function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  const patterns = [
    /(\d{4})[.\s]+([^R$]+)R\$\s*([\d.,]+)/i,
    /(\d{4})\s+([^0-9]+?)\s+([\d.,]+)/i,
    /(\d{3,4})[.\s]+([^\d]+)[\s.]*?([\d.,]+)/i
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const code = match[1].padStart(4, '0');
        if (codes.includes(code)) {
          const description = match[2].trim();
          const value = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));

          if (!isNaN(value)) {
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

  const patterns = [
    /(\d{3,4})[.\s-]+([^0-9R$]+)[R$\s]*([\d.,]+)/i,
    /(\d{3,4})\s+([^0-9]+?)\s+([\d.,]+)/i
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const code = match[1].padStart(4, '0');
        if (codes.includes(code)) {
          const description = match[2].trim();
          const value = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));

          if (!isNaN(value)) {
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

      if (!date) {
        console.log('Data não encontrada na página');
        continue;
      }

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