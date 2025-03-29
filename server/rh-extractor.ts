import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';
import { extractTextFromPDF } from './pdf-extractor';
import { predefinedCodes } from './payroll-definitions';

export async function processPDF(
  pdfBuffer: Buffer,
  codes: string[]
): Promise<ProcessedPayslip[]> {
  try {
    console.log(`Processando PDF RH`, codes);
    const pages = await extractTextFromPDF(pdfBuffer);
    const payslipsByDate = new Map<string, ExtractedPayrollItem[]>();

    for (const page of pages) {
      const date = extractRHDate(page.text);
      if (!date) {
        console.log(`Data não encontrada na página ${page.pageNumber}`);
        continue;
      }

      const items = extractPayrollItems(page.text, codes);
      if (items.length > 0) {
        if (!payslipsByDate.has(date)) {
          payslipsByDate.set(date, []);
        }
        
        // Agregar itens da página à data correspondente
        const dateItems = payslipsByDate.get(date)!;
        items.forEach(item => {
          const existingItem = dateItems.find(i => i.code === item.code);
          if (existingItem) {
            existingItem.value = parseFloat((existingItem.value + item.value).toFixed(2));
          } else {
            dateItems.push({...item});
          }
        });
      }
    }

    // Converter o Map em array de resultados
    const results = Array.from(payslipsByDate.entries()).map(([date, items]) => ({
      date,
      items,
      source: 'RH' as const
    }));

    console.log(`Processadas ${results.length} folhas de pagamento distintas`);
    return results;
  } catch (error) {
    console.error('Erro ao processar PDF RH:', error);
    throw error;
  }
}

function extractRHDate(text: string): string | null {
  const months = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };

  const datePatterns = [
    new RegExp(`(${Object.keys(months).join('|')})[/-]\\s*(\\d{4})`, 'i'),
    /(\d{2})[/-]\s*(\d{4})/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let month: string;
      if (match[1].length > 2) {
        // Se for nome do mês
        month = months[match[1].toLowerCase()];
      } else {
        // Se for número do mês
        month = match[1];
      }
      const date = `${month}/${match[2]}`;
      console.log(`Data encontrada: ${date}`);
      return date;
    }
  }
  return null;
}

export function extractPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const itemsMap = new Map<string, ExtractedPayrollItem>();

  for (const code of codes) {
    // Determina se o código é uma vantagem ou desconto
    const codeDefinition = predefinedCodes.find(pc => 
      pc.code.split(/[,\s]+/).some(c => c.trim() === code)
    );

    // Padrão regex melhorado para capturar valores
    const pattern = new RegExp(
      `(?:.*?\\s)?\\b${code}\\b[\\s.]*([^\\n\\r]+?)\\s+(?:\\d+(?:\\.\\d{2})?\\s+)?(\\d{2}\\.\\d{4})?\\s*R?\\$?\\s*(\\d+(?:[.,]\\d{3})*(?:[.,]\\d{2}))`,
      'gi'
    );

    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const description = match[1].trim();
      const valueStr = match[3].replace(/\./g, '').replace(',', '.');
      const value = parseFloat(valueStr);

      if (!isNaN(value) && description) {
        const key = `${code}-${description}`;
        if (itemsMap.has(key)) {
          const existingItem = itemsMap.get(key)!;
          existingItem.value = parseFloat((existingItem.value + value).toFixed(2));
        } else {
          // Adiciona o item com a categoria correta
          itemsMap.set(key, { 
            code, 
            description,
            value,
            category: codeDefinition?.category || 'OUTROS'
          });
        }
      }
    }
  }

  // Combinar itens com o mesmo código
  const combinedItems = new Map<string, ExtractedPayrollItem>();
  for (const item of itemsMap.values()) {
    const key = item.code;
    if (combinedItems.has(key)) {
      const existingItem = combinedItems.get(key)!;
      existingItem.value += item.value;
    } else {
      combinedItems.set(key, {...item});
    }
  }

  return Array.from(combinedItems.values());
}