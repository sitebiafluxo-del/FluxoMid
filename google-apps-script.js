/**
 * Webhook para receber dados do painel de fluxo e salvar no Google Sheets.
 *
 * Como usar:
 * 1) Crie uma planilha no Google Sheets.
 * 2) Abra Extensoes > Apps Script.
 * 3) Cole este codigo e ajuste SPREADSHEET_ID e SHEET_NAME.
 * 4) Deploy > New deployment > Web app.
 * 5) Execute as: Me | Who has access: Anyone.
 * 6) Copie a URL do Web App e cole no campo "URL da Planilha" no painel.
 */

const SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_PLANILHA";
const SHEET_NAME = "Fluxo";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const sheet = getOrCreateSheet_();
    ensureHeader_(sheet);

    const date = payload.date || "";
    const createdAt = payload.createdAt || "";
    const reason = payload.reason || "";
    const total = Number(payload.total || 0);
    const intervals = Array.isArray(payload.intervals) ? payload.intervals : [];

    if (intervals.length === 0) {
      sheet.appendRow([new Date(), date, "", 0, 0, total, reason, createdAt]);
    } else {
      intervals.forEach((item) => {
        const slot = item.slot || "";
        const people = Number(item.people || 0);
        sheet.appendRow([new Date(), date, slot, people, 0, total, reason, createdAt]);
      });
    }

    recalculateAccumulatedByDate_(sheet, date);

    return jsonResponse_(200, { ok: true, message: "Dados salvos com sucesso" });
  } catch (error) {
    return jsonResponse_(500, { ok: false, message: String(error) });
  }
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "TimestampRecepcao",
    "DataPainel",
    "Intervalo",
    "Pessoas",
    "AcumuladoPorData",
    "TotalNoEnvio",
    "MotivoSync",
    "CriadoEmISO",
  ]);
}

function recalculateAccumulatedByDate_(sheet, targetDate) {
  if (!targetDate) return;
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;

  const rows = values.slice(1);
  let accumulated = 0;
  rows.forEach((row, idx) => {
    const rowDate = row[1];
    const people = Number(row[3] || 0);
    if (rowDate === targetDate) {
      accumulated += people;
      sheet.getRange(idx + 2, 5).setValue(accumulated);
    }
  });
}

function jsonResponse_(statusCode, body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
