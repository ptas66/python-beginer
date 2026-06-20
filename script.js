// ========== 1. ЗАГРУЗКА ДАННЫХ ==========
let componentsData = {};
let currentCategory = 'processors';
let selectedComponents = {};

fetch('components.json')
    .then(response => response.json())
    .then(data => {
        componentsData = data;
        renderCategory('processors');
    })
    .catch(error => {
        console.error('Ошибка загрузки данных:', error);
        document.getElementById('cardsContainer').innerHTML =
            '<p style="color:red;text-align:center;padding:40px;">Ошибка загрузки базы данных.<br>Проверьте файл components.json</p>';
    });

// ========== 2. ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ ==========
document.querySelectorAll('.categories button').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentCategory = this.dataset.category;
        renderCategory(currentCategory);
    });
});

document.querySelector('.categories button')?.classList.add('active');

// ========== 3. ПОЛУЧЕНИЕ ОТФИЛЬТРОВАННЫХ КОМПОНЕНТОВ ==========
function getFilteredComponents(category) {
    const allItems = componentsData[category] || [];

    if (Object.keys(selectedComponents).length === 0) {
        return allItems;
    }

    let filtered = allItems;

    switch(category) {
        case 'motherboards': {
            const cpu = selectedComponents['processors'];
            if (cpu) {
                filtered = filtered.filter(mb => mb.socket === cpu.socket);
            }
            break;
        }
        case 'ram': {
            const mb = selectedComponents['motherboards'];
            if (mb) {
                filtered = filtered.filter(ram => ram.type === mb.ram_type);
            }
            break;
        }
        case 'cooling': {
            const cpu = selectedComponents['processors'];
            if (cpu) {
                filtered = filtered.filter(cool => cool.socket.includes(cpu.socket));
            }
            break;
        }
        case 'videocards': {
            const caseItem = selectedComponents['cases'];
            if (caseItem) {
                filtered = filtered.filter(gpu => gpu.length <= caseItem.max_gpu_length);
            }
            break;
        }
        case 'cases': {
            const mb = selectedComponents['motherboards'];
            if (mb) {
                filtered = filtered.filter(c => c.form_factor === mb.form_factor);
            }
            break;
        }
        case 'psu': {
            const cpu = selectedComponents['processors'];
            const gpu = selectedComponents['videocards'];
            let requiredPower = 0;
            if (cpu) requiredPower += cpu.tdp || 0;
            if (gpu) requiredPower += gpu.power_consumption || 0;
            requiredPower += 100;
            if (requiredPower > 0) {
                filtered = filtered.filter(psu => psu.wattage >= requiredPower);
            }
            break;
        }
    }

    return filtered;
}

// ========== 4. ОТОБРАЖЕНИЕ КАРТОЧЕК ==========
function renderCategory(category) {
    const container = document.getElementById('cardsContainer');
    const items = getFilteredComponents(category);

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <p>Нет совместимых компонентов</p>
                <p style="font-size: 14px; margin-top: 5px;">Попробуйте выбрать другой компонент в другой категории</p>
            </div>
        `;
        return;
    }

    let html = '';
    items.forEach(item => {
        const isSelected = selectedComponents[category]?.id === item.id;
        html += `
            <div class="card ${isSelected ? 'selected' : ''}"
                 onclick="selectComponent('${category}', '${item.id}')">
                <h3>${item.model}</h3>
                <div class="price">${item.price.toLocaleString()} ₽</div>
                <div class="specs">${formatSpecs(category, item)}</div>
                ${isSelected ? '<div style="color:#1a73e8;font-weight:bold;margin-top:5px;">✓ Выбран</div>' : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

// ========== 5. ФОРМАТИРОВАНИЕ ХАРАКТЕРИСТИК ==========
function formatSpecs(category, item) {
    switch(category) {
        case 'processors': return `Сокет: ${item.socket} | TDP: ${item.tdp}Вт`;
        case 'motherboards': return `Сокет: ${item.socket} | ${item.form_factor} | ${item.ram_type}`;
        case 'videocards': return `Длина: ${item.length}мм | ${item.power_consumption}Вт`;
        case 'ram': return `${item.type} ${item.frequency}МГц | ${item.capacity}ГБ`;
        case 'storage': return `${item.type} | ${item.capacity}ГБ`;
        case 'psu': return `${item.wattage}Вт | ${item.brand}`;
        case 'cases': return `${item.form_factor} | GPU до ${item.max_gpu_length}мм`;
        case 'cooling': return `${item.type} | ${item.size ? item.size + 'мм' : 'Воздушное'}`;
        default: return '';
    }
}

// ========== 6. ВЫБОР КОМПОНЕНТА ==========
function selectComponent(category, id) {
    const items = componentsData[category] || [];
    const component = items.find(item => item.id === id);

    if (!component) return;

    const warnings = checkCompatibility(category, component);
    if (warnings.length > 0) {
        showWarningModal(warnings, function() {
            applySelection(category, component);
        });
        return;
    }
    applySelection(category, component);
}

function applySelection(category, component) {
    if (selectedComponents[category]?.id === component.id) {
        delete selectedComponents[category];
    } else {
        selectedComponents[category] = component;
    }
    renderCategory(currentCategory);
    updateBuildSummary();
}

// ========== 6.1. МОДАЛЬНОЕ ОКНО ДЛЯ ПРЕДУПРЕЖДЕНИЙ ==========
let modalCallback = null;

function showWarningModal(warnings, callback) {
    const modal = document.getElementById('warningModal');
    const body = document.getElementById('modalBody');
    const footer = document.getElementById('modalFooter');
    const title = document.getElementById('modalTitle');

    footer.style.display = 'flex';
    title.textContent = '⚠️ Внимание!';

    let html = '<p style="margin-bottom:12px;font-weight:500;color:#00FF55;">Вы выбрали компонент, который может быть несовместим с текущей сборкой:</p>';
    warnings.forEach(w => {
        html += `<div class="warning-item">⚠️ ${w}</div>`;
    });
    html += '<p style="margin-top:14px;color:#888;font-size:14px;">Вы уверены, что хотите продолжить?</p>';

    body.innerHTML = html;
    modal.style.display = 'block';
    modalCallback = callback;
}

function closeModal() {
    document.getElementById('warningModal').style.display = 'none';
    document.getElementById('modalFooter').style.display = 'flex';
    document.getElementById('modalTitle').textContent = '⚠️ Внимание!';
    modalCallback = null;
}

document.addEventListener('DOMContentLoaded', function() {
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');
    const overlay = document.querySelector('.modal-overlay');

    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (modalCallback) {
                modalCallback();
            }
            closeModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            closeModal();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
});

// ========== 7. ПРОВЕРКА СОВМЕСТИМОСТИ ==========
function checkCompatibility(category, component) {
    const warnings = [];
    switch(category) {
        case 'processors': {
            const mb = selectedComponents['motherboards'];
            if (mb && component.socket !== mb.socket) warnings.push(`Процессор (${component.socket}) несовместим с материнской платой (${mb.socket})`);
            break;
        }
        case 'motherboards': {
            const cpu = selectedComponents['processors'];
            if (cpu && component.socket !== cpu.socket) warnings.push(`Материнская плата (${component.socket}) несовместима с процессором (${cpu.socket})`);
            const ram = selectedComponents['ram'];
            if (ram && component.ram_type !== ram.type) warnings.push(`Материнская плата (${component.ram_type}) несовместима с ОЗУ (${ram.type})`);
            break;
        }
        case 'ram': {
            const mb = selectedComponents['motherboards'];
            if (mb && component.type !== mb.ram_type) warnings.push(`ОЗУ (${component.type}) несовместимо с материнской платой (${mb.ram_type})`);
            break;
        }
        case 'videocards': {
            const caseItem = selectedComponents['cases'];
            if (caseItem && component.length > caseItem.max_gpu_length) warnings.push(`Видеокарта (${component.length}мм) не помещается в корпус (${caseItem.max_gpu_length}мм)`);
            const psu = selectedComponents['psu'];
            if (psu) {
                const cpu = selectedComponents['processors'];
                let totalPower = component.power_consumption || 0;
                if (cpu) totalPower += cpu.tdp || 0;
                totalPower += 100;
                if (totalPower > psu.wattage) warnings.push(`Блок питания (${psu.wattage}Вт) может быть недостаточен (требуется ~${totalPower}Вт)`);
            }
            break;
        }
        case 'cooling': {
            const caseItem = selectedComponents['cases'];
            if (caseItem && component.size && component.size > caseItem.max_cpu_cooler_height) warnings.push(`Кулер (${component.size}мм) не помещается в корпус (${caseItem.max_cpu_cooler_height}мм)`);
            const cpu = selectedComponents['processors'];
            if (cpu && !component.socket.includes(cpu.socket)) warnings.push(`Кулер не поддерживает сокет ${cpu.socket}`);
            break;
        }
        case 'cases': {
            const mb = selectedComponents['motherboards'];
            if (mb && component.form_factor !== mb.form_factor) warnings.push(`Корпус (${component.form_factor}) несовместим с материнской платой (${mb.form_factor})`);
            const gpu = selectedComponents['videocards'];
            if (gpu && gpu.length > component.max_gpu_length) warnings.push(`Видеокарта (${gpu.length}мм) не помещается в корпус (${component.max_gpu_length}мм)`);
            break;
        }
        case 'psu': {
            const cpu = selectedComponents['processors'];
            const gpu = selectedComponents['videocards'];
            let totalPower = 0;
            if (cpu) totalPower += cpu.tdp || 0;
            if (gpu) totalPower += gpu.power_consumption || 0;
            totalPower += 100;
            if (totalPower > component.wattage) warnings.push(`Блок питания (${component.wattage}Вт) недостаточен (требуется ~${totalPower}Вт)`);
            break;
        }
    }
    return warnings;
}

// ========== 8. ОБНОВЛЕНИЕ ИТОГОВОЙ СБОРКИ (БЕЗ ЭНЕРГОПОТРЕБЛЕНИЯ) ==========
function updateBuildSummary() {
    const buildList = document.getElementById('buildList');
    const totalPrice = document.getElementById('totalPrice');
    const showLinksBtn = document.getElementById('showLinksBtn');

    let html = '';
    let total = 0;
    const categoryNames = {
        processors: 'Процессор', motherboards: 'Материнская плата',
        videocards: 'Видеокарта', ram: 'ОЗУ', storage: 'SSD',
        psu: 'Блок питания', cases: 'Корпус', cooling: 'Охлаждение'
    };
    let hasComponents = false;

    for (const [cat, comp] of Object.entries(selectedComponents)) {
        if (comp) {
            hasComponents = true;
            html += `<div class="build-item"><span class="category-label">${categoryNames[cat] || cat}:</span><span class="component-name">${comp.model}</span></div>`;
            total += comp.price || 0;
        }
    }

    if (!hasComponents) {
        html = '<p style="color:#888;text-align:center;padding:20px 0;">Компоненты не выбраны</p>';
        total = 0;
    }

    buildList.innerHTML = html;
    totalPrice.textContent = total.toLocaleString();

    if (hasComponents) {
        showLinksBtn.style.display = 'block';
    } else {
        showLinksBtn.style.display = 'none';
    }
}

// ========== 9. КНОПКА "ПЕРЕЙТИ К ССЫЛКАМ" ==========
document.getElementById('showLinksBtn').addEventListener('click', function() {
    let hasComponents = false;
    let linksHtml = '';
    let linksArray = [];
    
    const categoryNames = {
        processors: 'Процессор',
        motherboards: 'Материнская плата',
        videocards: 'Видеокарта',
        ram: 'ОЗУ',
        storage: 'SSD',
        psu: 'Блок питания',
        cases: 'Корпус',
        cooling: 'Охлаждение'
    };
    
    for (const [cat, comp] of Object.entries(selectedComponents)) {
        if (comp) {
            hasComponents = true;
            const name = categoryNames[cat] || cat;
            if (comp.link) {
                linksHtml += `<div class="link-item"><span class="link-category">${name}:</span> <a href="${comp.link}" target="_blank" class="link-url">${comp.model}</a></div>`;
                linksArray.push(comp.link);
            } else {
                linksHtml += `<div class="link-item"><span class="link-category">${name}:</span> <span style="color:#888;">ссылка не указана</span></div>`;
            }
        }
    }
    
    if (!hasComponents) {
        alert('Сначала выберите компоненты!');
        return;
    }
    
    document.getElementById('modalFooter').style.display = 'none';
    document.getElementById('modalTitle').textContent = '🛒 Ссылки на товары';
    
    const modal = document.getElementById('warningModal');
    const body = document.getElementById('modalBody');
    
    let html = `
        <div style="margin-bottom:15px;font-weight:500;color:#00FF55;font-size:16px;">
            Ссылки на выбранные компоненты:
        </div>
        <div style="max-height:250px;overflow-y:auto;">
            ${linksHtml}
        </div>
        <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">
            <button onclick="window._openAllLinks()" 
                    class="modal-link-btn modal-link-btn-open">
                🔗 Открыть все
            </button>
            <button onclick="window._copyLinks()" 
                    class="modal-link-btn modal-link-btn-copy">
                📋 Копировать ссылки
            </button>
            <button onclick="closeModal()" 
                    class="modal-link-btn modal-link-btn-close">
                ✕ Закрыть
            </button>
        </div>
    `;
    
    body.innerHTML = html;
    modal.style.display = 'block';
    
    window._linksArray = linksArray;
    window._openAllLinks = function() {
        if (linksArray.length === 0) {
            alert('Нет ссылок для открытия.');
            return;
        }
        if (linksArray.length > 5) {
            if (confirm(`Найдено ${linksArray.length} ссылок. Открыть все?`)) {
                linksArray.forEach(link => window.open(link, '_blank'));
            }
        } else {
            linksArray.forEach(link => window.open(link, '_blank'));
        }
    };
    window._copyLinks = function() {
        if (linksArray.length === 0) {
            alert('Нет ссылок для копирования.');
            return;
        }
        const text = linksArray.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert('✅ Ссылки скопированы в буфер обмена!');
        }).catch(() => {
            alert('Скопируйте ссылки вручную:\n\n' + text);
        });
    };
});

// ========== 10. СБРОС СБОРКИ ==========
document.getElementById('resetBuild').addEventListener('click', function() {
    selectedComponents = {};
    renderCategory(currentCategory);
    updateBuildSummary();
});

// ========== 11. ПЕРВАЯ ЗАГРУЗКА ==========
renderCategory('processors');