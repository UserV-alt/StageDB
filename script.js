// URL of your published Google Sheet CSV
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7fCbaazdSAU8waEDn0qOYpss-7d5o-biapcazP1XCWG4seaP9ZNujAFCbydUneYy3JMdYXf3bIVxo/pub?gid=2058940071&single=true&output=csv';

const APPLIED_KEY = 'stagedb_applied_list';

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    // Event listener for checkboxes
    document.getElementById('table-body').addEventListener('change', (e) => {
        if (e.target.classList.contains('applied-checkbox')) {
            const rowId = e.target.dataset.rowId;
            const isChecked = e.target.checked;
            toggleAppliedStatus(rowId, isChecked, e.target.closest('tr'));
        }
    });

    // Force direct download for the CV button
    const downloadBtn = document.querySelector('.btn-download');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = downloadBtn.getAttribute('href');
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = 'CV_Blank.tex';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(blobUrl);
                a.remove();
            } catch (err) {
                console.error('Download failed', err);
                window.location.href = url;
            }
        });
    }

    // Search Filtering Logic
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            filterTable(term);
        });
    }
});

function filterTable(term) {
    const rows = document.querySelectorAll('#table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(term)) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

async function fetchData() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    
    const proxies = [
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        (url) => url
    ];

    for (const getProxyUrl of proxies) {
        try {
            const currentUrl = getProxyUrl(SHEET_CSV_URL);
            const response = await fetch(currentUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            let csvText;
            if (currentUrl.includes('allorigins.win')) {
                const data = await response.json();
                csvText = data.contents;
            } else {
                csvText = await response.text();
            }

            if (csvText.startsWith('data:text/csv;base64,')) {
                const base64Data = csvText.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                csvText = new TextDecoder('utf-8').decode(bytes);
            }

            if (csvText && csvText.includes(',')) {
                parseCSV(csvText);
                return;
            }
        } catch (error) {
            console.warn(`Proxy failed`, error);
        }
    }

    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = 'Error: Could not reach Google Sheets. All proxy attempts failed.';
}

function parseCSV(csvText) {
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
            if (results.data && results.data.length > 0) {
                renderData(results.data);
            } else {
                renderError('The spreadsheet appears to be empty or formatted incorrectly.');
            }
        },
        error: (error) => {
            renderError('Error parsing CSV data: ' + error.message);
        }
    });
}

function renderError(msg) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = msg;
}

function getAppliedList() {
    const list = localStorage.getItem(APPLIED_KEY);
    return list ? JSON.parse(list) : [];
}

function toggleAppliedStatus(rowId, isChecked, trElement) {
    let list = getAppliedList();
    if (isChecked) {
        if (!list.includes(rowId)) list.push(rowId);
        trElement.classList.add('applied');
    } else {
        list = list.filter(id => id !== rowId);
        trElement.classList.remove('applied');
    }
    localStorage.setItem(APPLIED_KEY, JSON.stringify(list));
}

function generateRowId(row) {
    const name = (row['Nom Entreprise'] || '').trim().toLowerCase();
    const email = (row['email'] || '').trim().toLowerCase();
    const str = name + email;
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return str.replace(/[^a-z0-9]/g, '_');
    }
}

function renderData(data) {
    const loadingEl = document.getElementById('loading');
    const tableBody = document.getElementById('table-body');
    const errorEl = document.getElementById('error');
    
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    tableBody.innerHTML = '';

    const appliedList = getAppliedList();

    data.forEach((row) => {
        const tr = document.createElement('tr');
        const rowId = generateRowId(row);
        
        const isApplied = appliedList.includes(rowId);
        if (isApplied) tr.classList.add('applied');

        // Status Checkbox
        const statusTd = document.createElement('td');
        statusTd.className = 'status-cell';
        statusTd.innerHTML = `<input type="checkbox" class="applied-checkbox" data-row-id="${rowId}" ${isApplied ? 'checked' : ''}>`;
        tr.appendChild(statusTd);

        // Data Columns
        const columns = ['email', 'Nom Entreprise', 'SiteWeb Entreprise', 'Nom Recruteur', 'Description', 'Page LinkedIn'];

        columns.forEach(col => {
            const td = document.createElement('td');
            const actualKey = Object.keys(row).find(k => {
                const nk = k.trim().toLowerCase();
                const nc = col.trim().toLowerCase();
                return nk === nc || nk.includes(nc);
            });

            let value = actualKey ? row[actualKey] : '-';
            value = (value && value.trim()) ? value : '-';
            
            if (value !== '-' && (col === 'Page LinkedIn' || col === 'SiteWeb Entreprise' || value.startsWith('http'))) {
                const url = value.startsWith('http') ? value : `https://${value}`;
                const isLinkedIn = col === 'Page LinkedIn' || url.includes('linkedin.com');
                const badgeClass = isLinkedIn ? 'badge-linkedin' : 'badge-website';
                const label = isLinkedIn ? 'LinkedIn' : 'Website';
                td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="badge-link ${badgeClass}">${label}</a>`;
            } else if (value !== '-' && (col === 'email' || value.includes('@'))) {
                td.innerHTML = `<a href="mailto:${value}" class="badge-email">${value}</a>`;
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}
