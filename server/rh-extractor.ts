
import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'pdfjs-dist/legacy/build/pdf.worker.entry';

interface PDFPage {
  text: string;
  pageNumber: number;
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFPage[]> {
  console.log("Iniciando extração do PDF RH...");

  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    const pages: PDFPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
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
    console.error("Erro ao extrair texto do PDF RH:", error);
    throw error;
  }
}

export function extractDate(text: string): string | null {
  const monthMap: { [key: string]: string } = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  const monthPattern = Object.keys(monthMap).join('|');
  const patterns = [
    new RegExp(`\\b(${monthPattern})[\/\\s]*(?:de)?[\\s]*(\\d{4})\\b`, 'i'),
    /(\d{2})[\/\s-](\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (monthMap[match[1].toLowerCase()]) {
        return `${monthMap[match[1].toLowerCase()]}/${match[2]}`;
      }
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

export function extractPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);
  const monthPattern = /\d{2}\.\d{4}/;

  for (const code of codes) {
    const matches = [];
    
    for (const line of lines) {
      const pattern = new RegExp(`(?:.*?\\s)?\\b${code}\\b[\\s.]*([^\\n\\r]+?)\\s+(?:\\d+(?:\\.\\d{2})?\\s+)?(\\d{2}\\.\\d{4})?\\s*R?\\$?\\s*(\\d+(?:[.,]\\d{3})*(?:[.,]\\d{2}))`, 'i');
      const match = line.match(pattern);

      if (match) {
        const description = match[1].trim();
        const month = match[2] || '';
        const valueStr = match[3].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(valueStr);

        console.log(`RH - Extraindo código ${code}: valor original="${match[3]}", convertido="${valueStr}", final=${value}, mês=${month}`);

        if (!isNaN(value) && description) {
          matches.push({ description, value, month });
        }
      }
    }

    // Agrupa por mês e pega o maior valor de cada mês
    const monthGroups = new Map();
    matches.forEach(match => {
      const currentValue = monthGroups.get(match.month)?.value || 0;
      if (match.value > currentValue) {
        monthGroups.set(match.month, { value: match.value, description: match.description });
      }
    });

    // Pega o maior valor entre todos os meses
    let maxValue = 0;
    let maxDescription = '';
    monthGroups.forEach((data) => {
      if (data.value > maxValue) {
        maxValue = data.value;
        maxDescription = data.description;
      }
    });

    if (maxValue > 0) {
      items.push({ code, description: maxDescription, value: maxValue });
    }
  }

  return items;
}

export async function processPDF(pdfBuffer: Buffer, codes: string[]): Promise<ProcessedPayslip[]> {
  try {
    console.log(`Processando PDF RH`, codes);

    const pages = await extractTextFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    for (const page of pages) {
      console.log(`Processando página RH ${page.pageNumber}`);

      const date = extractDate(page.text);
      if (!date) {
        console.log(`Data não encontrada na página ${page.pageNumber}`);
        continue;
      }
      console.log('Data extraída RH:', date);

      const items = extractPayrollItems(page.text, codes);
      console.log(`Encontrados ${items.length} itens na página RH ${page.pageNumber}`);

      if (items.length > 0) {
        results.push({ date, items, source: 'RH' });
      }
    }

    console.log(`Processamento RH finalizado. Encontrados ${results.length} conjuntos de dados.`);
    return results;
  } catch (error) {
    console.error('Erro ao processar PDF RH:', error);
    throw error;
  }
}
