
import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import * as pdfjsLib from 'pdfjs-dist';

export type PDFSource = 'ERP' | 'RH';

// Initialize worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function getDocument(pdfBuffer: Buffer) {
  return pdfjsLib.getDocument({
    data: pdfBuffer,
    useWorkerFetch: false,
    isEvalSupported: false
  }).promise;
}

async function extractPageText(page: any): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item: any) => item.str)
    .join(' ');
}

function extractERPDate(text: string): string | null {
  const patterns = [
    /(?:Compet[êe]ncia|Per[íi]odo|Data[^:]*?):\s*(\d{2})[\/\s-](\d{4})/i,
    /(\d{2})[\/\s-](\d{4})/
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
  const monthMap: { [key: string]: string } = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  const monthPattern = Object.keys(monthMap).join('|');
  const pattern = new RegExp(`(${monthPattern})[\/\\s]*de[\\s]*?(\\d{4})`, 'i');
  
  const match = text.match(pattern);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    return `${month}/${match[2]}`;
  }
  return null;
}

function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const code of codes) {
    const patterns = [
      new RegExp(`${code}[\\s.]+([^\\n\\r]+?)\\s+R\\$\\s*(\\d+[.,]\\d{2})`, 'i'),
      new RegExp(`${code}[\\s.]+([^\\n\\r]+?)\\s+(\\d+[.,]\\d{2})`, 'i')
    ];
    
    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const description = match[1].trim();
          const value = parseFloat(
            match[2].replace(/\./g, '').replace(',', '.')
          );
          
          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
          break;
        }
      }
    }
  }

  return items;
}

function extractRHItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const code of codes) {
    const patterns = [
      new RegExp(`${code}[\\s.]+([^\\n\\r]+?)\\s+(\\d+[.,]\\d{2})`, 'i'),
      new RegExp(`${code}[\\s.]+([^\\n\\r]+?)\\s+R\\$\\s*(\\d+[.,]\\d{2})`, 'i')
    ];
    
    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const description = match[1].trim();
          const valueIndex = pattern.toString().includes('R\\$') ? 2 : 1;
          const value = parseFloat(
            match[valueIndex].replace(/\./g, '').replace(',', '.')
          );
          
          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
          break;
        }
      }
    }
  }

  return items;
}

export async function processPDF(
  pdfBuffer: Buffer, 
  codes: string[], 
  source: PDFSource
): Promise<ProcessedPayslip[]> {
  try {
    const doc = await getDocument(pdfBuffer);
    const results: ProcessedPayslip[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const text = await extractPageText(page);
      console.log('Texto extraído da página:', text);

      const date = source === 'ERP' ? 
        extractERPDate(text) : 
        extractRHDate(text);

      console.log('Data extraída:', date);

      if (!date) continue;

      const items = source === 'ERP' ?
        extractERPItems(text, codes) :
        extractRHItems(text, codes);

      console.log('Itens extraídos:', items);

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
