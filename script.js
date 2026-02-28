const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileNameDisplay = document.getElementById('file-name');
const outputFormatSelect = document.getElementById('output-format');
const convertBtn = document.getElementById('convert-btn');
const statusMessage = document.getElementById('status-message');

let currentFile = null;
const supportedFormats = ['csv', 'json', 'xml', 'xlsx'];
const x2js = new X2JS();

// Drag and drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) handleFile(files[0]);
});

fileInput.addEventListener('change', function() {
    if (this.files.length > 0) handleFile(this.files[0]);
});

function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!supportedFormats.includes(ext)) {
        showStatus('Formato de arquivo não suportado. Use CSV, JSON, XML ou XLSX.', 'error');
        resetUI();
        return;
    }

    currentFile = file;
    fileNameDisplay.textContent = file.name;
    
    // Preenche as opções de formato de saída
    outputFormatSelect.innerHTML = '';
    supportedFormats.forEach(format => {
        if (format !== ext) {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format.toUpperCase();
            outputFormatSelect.appendChild(option);
        }
    });
    
    outputFormatSelect.disabled = false;
    convertBtn.disabled = false;
    showStatus('', '');
}

function resetUI() {
    currentFile = null;
    fileInput.value = '';
    fileNameDisplay.textContent = 'Clique para escolher ou arraste um arquivo';
    outputFormatSelect.innerHTML = '<option value="">Selecione o arquivo primeiro</option>';
    outputFormatSelect.disabled = true;
    convertBtn.disabled = true;
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status ' + type;
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadXLSX(workbook, fileName) {
    XLSX.writeFile(workbook, fileName);
}

// Funções de leitura de arquivo
async function readAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsText(file);
    });
}

async function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

// Converte qualquer formato de entrada para um objeto JSON intermediário
async function fileToJson(file, ext) {
    if (ext === 'json') {
        const text = await readAsText(file);
        return JSON.parse(text);
    }
    if (ext === 'csv') {
        const text = await readAsText(file);
        return new Promise((resolve) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data)
            });
        });
    }
    if (ext === 'xml') {
        const text = await readAsText(file);
        const jsonObj = x2js.xml_str2json(text);
        
        // Tenta simplificar a estrutura se for uma lista empacotada
        if (jsonObj) {
            const keys = Object.keys(jsonObj);
            if (keys.length === 1 && Array.isArray(jsonObj[keys[0]])) {
                return jsonObj[keys[0]];
            }
            if (keys.length === 1 && typeof jsonObj[keys[0]] === 'object') {
                 const subKeys = Object.keys(jsonObj[keys[0]]);
                 if(subKeys.length === 1 && Array.isArray(jsonObj[keys[0]][subKeys[0]])) {
                     return jsonObj[keys[0]][subKeys[0]];
                 }
            }
        }
        return jsonObj;
    }
    if (ext === 'xlsx') {
        const buffer = await readAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_json(worksheet);
    }
}

// Converte o objeto JSON intermediário para o formato de saída desejado e faz o download
function jsonToOutput(jsonObj, targetExt, originalName) {
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    const newName = `${baseName}.${targetExt}`;

    try {
        if (targetExt === 'json') {
            downloadFile(JSON.stringify(jsonObj, null, 2), newName, 'application/json');
        } 
        else if (targetExt === 'csv') {
            // Garante que é um array para o CSV
            let data = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
            if (!Array.isArray(jsonObj) && typeof jsonObj === 'object') {
                const keys = Object.keys(jsonObj);
                if (keys.length === 1 && Array.isArray(jsonObj[keys[0]])) {
                    data = jsonObj[keys[0]];
                }
            }
            const csv = Papa.unparse(data);
            downloadFile(csv, newName, 'text/csv;charset=utf-8;');
        }
        else if (targetExt === 'xml') {
            // Empacota em uma tag <root> se for um array ou múltiplos atributos na raiz
            let rootObj = jsonObj;
            if (Array.isArray(jsonObj)) {
                rootObj = { root: { row: jsonObj } };
            } else if (Object.keys(jsonObj).length > 1) {
                rootObj = { root: jsonObj };
            }
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + x2js.json2xml_str(rootObj);
            downloadFile(xml, newName, 'application/xml');
        }
        else if (targetExt === 'xlsx') {
             let data = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
             if (!Array.isArray(jsonObj) && typeof jsonObj === 'object') {
                const keys = Object.keys(jsonObj);
                if (keys.length === 1 && Array.isArray(jsonObj[keys[0]])) {
                    data = jsonObj[keys[0]];
                }
            }
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            downloadXLSX(workbook, newName);
        }
        showStatus('Conversão concluída com sucesso!', 'success');
    } catch (err) {
        console.error(err);
        showStatus('Erro ao converter os dados.', 'error');
    }
}

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const inputExt = currentFile.name.split('.').pop().toLowerCase();
    const targetExt = outputFormatSelect.value;
    
    showStatus('Convertendo...', '');
    convertBtn.disabled = true;

    try {
        const jsonObj = await fileToJson(currentFile, inputExt);
        if (!jsonObj) throw new Error("Não foi possível ler os dados do arquivo.");
        
        jsonToOutput(jsonObj, targetExt, currentFile.name);
    } catch (error) {
        console.error(error);
        showStatus('Erro durante a conversão: Verifique o formato do arquivo.', 'error');
    } finally {
        convertBtn.disabled = false;
    }
});