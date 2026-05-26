let persons = [];
        let customDailyCapacities = {}; // { dayIndex: count } - günlere özel kapasite
        let tempCustomCapacities = {}; // Modal açıkken geçici tutar
        let availabilityMode = true;
        let loginSuggestionShown = false; 

        function savePersonsToLocalStorage() {
            // 1. Önce eskisi gibi tarayıcıya kaydet
            localStorage.setItem('nobetPlaniPersonelListesi', JSON.stringify(persons));
            
            if (auth.currentUser) {
                saveToFirestore();
            }
        }

        function normalizeName(str) {
            return str.trim()
                .toUpperCase()
                .replace(/Ç/g, 'C')
                .replace(/Ğ/g, 'G')
                .replace(/İ/g, 'I')
                .replace(/Ö/g, 'O')
                .replace(/Ş/g, 'S')
                .replace(/Ü/g, 'U')
                .replace(/ç/g, 'C')
                .replace(/ğ/g, 'G')
                .replace(/ı/g, 'I')
                .replace(/ö/g, 'O')
                .replace(/ş/g, 'S')
                .replace(/ü/g, 'U');
        }


        function getFormInputs() {
            return {
                startInput: document.getElementById('startDate').value,
                endInput:   document.getElementById('endDate').value,
                dutyPerDay: parseInt(document.getElementById('dutyPerDay').value) || 0,
                holidays:   getHolidays()
            };
        }

        function showLoading() {
            document.getElementById('loadingOverlay').style.display = 'flex';
        }
        function hideLoading() {
            document.getElementById('loadingOverlay').style.display = 'none';
        }


        function parseDate(str) {
            const [d, m, y] = str.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            dt.setHours(0, 0, 0, 0);
            return dt;
        }

        function daysBetween(startStr, endStr) {
            return Math.ceil((parseDate(endStr) - parseDate(startStr)) / (1000 * 60 * 60 * 24)) + 1;
        }


        function getHolidays(str) {
            const val = str !== undefined ? str : document.getElementById('holidays').value;
            return val ? val.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];
        }

        function isWeekendDay(date, holidays) {
            return date.getDay() === 0 || date.getDay() === 6 || (holidays && holidays.includes(date.getDate()));
        }

        function loadPersonsFromLocalStorage() {
            const savedPersons = localStorage.getItem('nobetPlaniPersonelListesi');
            if (savedPersons) {
                persons = JSON.parse(savedPersons).map(p => ({ ...p, name: normalizeName(p.name) }));
            }
        }
        
        let unavailableCells = {};
        let selectedCells = {};
        let collapsiblePersonel;
        let collapsibleCalendar;
        let statsCollapsible;
        let guideCollapsible;
        let validationErrors = [];
        let history = [];
        let historyIndex = -1;
        let isDragging = false;
        let dragStart = null;
        let isUploading = false;

        const defaultPersons = [];

        function isMobileDevice() {
            return /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 600;
        }

        function showToast(message, duration = 4000) {
            M.Toast.dismissAll(); // Eski toast'ları kaldır
            M.toast({ html: message, displayLength: duration });
        }

        document.addEventListener('DOMContentLoaded', function() {

            loadPersonsFromLocalStorage(); // Kayıtlı personel listesini yükle
            
            const elems = document.querySelectorAll('.collapsible, .datepicker, .dropdown-trigger, .modal');
            M.Collapsible.init(document.querySelectorAll('.collapsible'), { accordion: false });
            M.Datepicker.init(document.querySelectorAll('.datepicker'), {
                format: 'dd-mm-yyyy',
                autoClose: true,
                firstDay: 1,
                i18n: {
                    months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
                    monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
                    weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
                    weekdaysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
                    weekdaysAbbrev: ['P', 'P', 'S', 'Ç', 'P', 'C', 'C']
                },
                onOpen: function() {
                    const instance = this;
                    setTimeout(() => {
                        const days = instance.el.parentElement.querySelectorAll('.datepicker-table th');
                        days.forEach((day, index) => {
                            day.textContent = this.options.i18n.weekdaysShort[index];
                        });
                    }, 0);
                }
            });

           const holidaysInput = document.getElementById('holidays');
                let selectedDays = []; // Seçilen günleri tutacak dizi
            
                const holidaysPicker = M.Datepicker.init(holidaysInput, {
                    format: 'dd-mm-yyyy',
                    autoClose: false, // Kullanıcı seçim yapana kadar kapanmasın
                    firstDay: 1,
                    i18n: {
                        months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
                        monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
                        weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
                        weekdaysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
                        weekdaysAbbrev: ['P', 'P', 'S', 'Ç', 'P', 'C', 'C']
                    },
                    onOpen: function() {
                        const startDatePicker = document.getElementById('startDate');
                        const startDateInstance = M.Datepicker.getInstance(startDatePicker);
                        if (startDateInstance && startDateInstance.date) {
                            this.gotoDate(startDateInstance.date);
                        }
                
                        setTimeout(() => {
                            const dayElements = this.el.parentElement.querySelectorAll('.datepicker-day-button');
                            dayElements.forEach(day => {
                                const dayNum = parseInt(day.textContent);
                                if (selectedDays.includes(dayNum)) {
                                    day.classList.add('selected-day'); 
                                } else {
                                    day.classList.remove('selected-day');
                                }
                            });
                        }, 0);
                    },
                    onSelect: function(date) {
                        const day = date.getDate();
                        const index = selectedDays.indexOf(day);
                
                        if (index !== -1) {
                            selectedDays.splice(index, 1);
                        } else {
                            selectedDays.push(day);
                        }
                
                        selectedDays.sort((a, b) => a - b);
                        holidaysInput.value = selectedDays.join(',');
                
                        const dayElements = this.el.parentElement.querySelectorAll('.datepicker-day-button');
                        dayElements.forEach(dayEl => {
                            const dayNum = parseInt(dayEl.textContent);
                            if (selectedDays.includes(dayNum)) {
                                dayEl.classList.add('selected-day');
                            } else {
                                dayEl.classList.remove('selected-day');
                            }
                        });
                
                        M.updateTextFields();
                        holidaysInput.dispatchEvent(new Event('input')); // Materialize’a içeriğin değiştiğini bildir
                        if (selectedDays.length > 0 && holidaysInput.value.match(/^(\d{1,2}(,\d{1,2})*)?$/)) {
                            holidaysInput.classList.remove('invalid');
                            holidaysInput.classList.add('valid');
                        } else {
                            holidaysInput.classList.remove('valid');
                            holidaysInput.classList.add('invalid');
                        }
                    },
                    onClose: function() {
                        holidaysInput.value = selectedDays.join(',');
                        M.updateTextFields();
                        holidaysInput.dispatchEvent(new Event('input')); // Materialize’a içeriğin değiştiğini bildir
                        if (selectedDays.length > 0 && holidaysInput.value.match(/^(\d{1,2}(,\d{1,2})*)?$/)) {
                            holidaysInput.classList.remove('invalid');
                            holidaysInput.classList.add('valid');
                        } else {
                            holidaysInput.classList.remove('valid');
                            holidaysInput.classList.add('invalid');
                        }
                    }
                });
                
                const style = document.createElement('style');
                style.innerHTML = `
                    .datepicker-day-button.selected-day {
                        background-color: #26a69a !important;
                        color: white !important;
                        border-radius: 50%;
                    }
                    input.validate.valid:not([type]), input.validate.valid[type="text"] {
                        border-bottom: 1px solid #4caf50 !important;
                        box-shadow: 0 1px 0 0 #4caf50 !important;
                    }
                    input.validate.invalid:not([type]), input.validate.invalid[type="text"] {
                        border-bottom: 1px solid #f44336 !important;
                        box-shadow: 0 1px 0 0 #f44336 !important;
                    }
                `;
                document.head.appendChild(style);

            M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), {
                coverTrigger: false,
                constrainWidth: false
            });
            M.Modal.init(document.querySelectorAll('.modal'));
        
            collapsiblePersonel = M.Collapsible.getInstance(document.querySelector('#personelCollapsible'));
            collapsibleCalendar = M.Collapsible.getInstance(document.querySelector('#calendarCollapsible'));
            statsCollapsible = M.Collapsible.getInstance(document.querySelector('#statsCollapsible'));
            guideCollapsible = M.Collapsible.getInstance(document.querySelector('#guideCollapsible'));

            setTimeout(() => {
                const guideBody = document.querySelector('#guideCollapsible .collapsible-body');
                if (guideBody) {
                   
                    guideBody.style.display = 'block';
                    guideBody.style.overflow = 'hidden';
                    guideBody.style.maxHeight = '0px';
                    guideBody.style.paddingTop = '0px';
                    guideBody.style.paddingBottom = '0px';
                   
                    guideBody.style.transition = 'max-height 0.5s ease-in-out, padding 0.5s ease-in-out';
                    
                    setTimeout(() => {
                        guideBody.style.maxHeight = '100px';  
                        guideBody.style.paddingTop = '1rem'; 
                        guideBody.style.paddingBottom = '1rem';
                    }, 100);

                    setTimeout(() => {
                        guideBody.style.maxHeight = '0px';
                        guideBody.style.paddingTop = '0px';
                        guideBody.style.paddingBottom = '0px';
                        
                        setTimeout(() => {
                            guideBody.style.display = '';
                            guideBody.style.maxHeight = '';
                            guideBody.style.overflow = '';
                            guideBody.style.paddingTop = '';
                            guideBody.style.paddingBottom = '';
                            guideBody.style.transition = '';
                        }, 500); 
                    }, 1000);
                }
            }, 1000);
        
            collapsibleCalendar.options.onOpenStart = function() {
                document.getElementById('calendarContainer').classList.add('expanded');
            };
            collapsibleCalendar.options.onCloseEnd = function() {
                document.getElementById('calendarContainer').classList.remove('expanded');
            };
        
            if (isMobileDevice()) {
                document.querySelectorAll('.btn-floating').forEach(btn => {
                    btn.style.width = '36px';
                    btn.style.height = '36px';
                    btn.style.lineHeight = '36px';
                });
                M.toast({ html: 'Mobilde "yatay" modda daha iyi bir deneyim elde edebilirsiniz!(Masaüstü kullanım önerilir)' });
            }
        
            const startDatePicker = document.getElementById('startDate');
            const endDatePicker = document.getElementById('endDate');
            startDatePicker.addEventListener('change', function() {
                const startDate = M.Datepicker.getInstance(startDatePicker).date;
                if (startDate) {
                    const lastDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                    const endDateInstance = M.Datepicker.getInstance(endDatePicker);
                    endDateInstance.setDate(lastDay);
                    endDatePicker.value = lastDay.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');
                    M.updateTextFields();
                }
                if (startDatePicker.value && endDatePicker.value && collapsiblePersonel) {
                    collapsiblePersonel.open(0);
                }
            });
        
            endDatePicker.addEventListener('change', function() {
                if (startDatePicker.value && endDatePicker.value && collapsiblePersonel) {
                    collapsiblePersonel.open(0);
                }
            });
        
            const personNameInput = document.getElementById('personName');
            if (personNameInput) {
                personNameInput.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        addPerson();
                    }
                });
            }
        
            persons = [...defaultPersons];
            renderTable();
        
            const csvUploadInput = document.getElementById('csvUpload');
            if (csvUploadInput) {
                csvUploadInput.removeEventListener('change', uploadPersonnel);
                csvUploadInput.addEventListener('change', uploadPersonnel);
            } else {
                console.error('csvUpload input elementi bulunamadı!');
            }
        
            const groupingSwitch = document.getElementById('groupingSwitch');
            groupingSwitch.style.display = 'none';

            M.Tooltip.init(document.querySelectorAll('.tooltipped'));
        });

        document.getElementById('dutyPerDay').addEventListener('change', function() {
            const dutyPerDay = parseInt(this.value) || 0;
            const groupingSwitch = document.getElementById('groupingSwitch');
            if (dutyPerDay >= 2) {
                groupingSwitch.style.display = 'block';
            } else {
                groupingSwitch.style.display = 'none';
                document.getElementById('groupingCheckbox').checked = false;
            }
            customDailyCapacities = {};
        });

        // ---- GÜNLERE ÖZEL KAPASİTE FONKSİYONLARI ----

        function toggleCustomCapacity() {
            const enabled = document.getElementById('customCapacityEnabled').checked;
            const btn = document.getElementById('customCapacityBtn');
            btn.style.display = enabled ? 'inline' : 'none';
            if (!enabled) {
                customDailyCapacities = {};
            }
        }

        function openCapacityModal() {
            const { startInput, endInput, dutyPerDay } = getFormInputs();
            if (!startInput || !endInput || !dutyPerDay) {
                M.toast({ html: 'Önce tarih aralığı ve günlük nöbetçi sayısını seçin!', classes: 'orange' });
                return;
            }
            const start = parseDate(startInput);
            const end = parseDate(endInput);
            const days = daysBetween(startInput, endInput);

            const holidays = getHolidays();

            const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

            tempCustomCapacities = Object.assign({}, customDailyCapacities);

            let html = `
            <style>
                .cap-stepper { display:flex; align-items:center; gap:0; }
                .cap-stepper button {
                    width:28px; height:28px; border:1px solid #ccc; background:#f5f5f5;
                    font-size:1.1rem; line-height:1; cursor:pointer; color:#444;
                    transition: background .15s;
                    flex-shrink:0;
                }
                .cap-stepper button:first-child { border-radius:6px 0 0 6px; border-right:none; }
                .cap-stepper button:last-child  { border-radius:0 6px 6px 0; border-left:none; }
                .cap-stepper button:hover:not(:disabled) { background:#e0e0e0; }
                .cap-stepper button:disabled { opacity:.35; cursor:default; }
                .cap-stepper .cap-val {
                    width:36px; height:28px; border:1px solid #ccc; background:#fff;
                    text-align:center; font-size:.9rem; line-height:28px;
                    user-select:none; font-weight:600;
                }
                .cap-stepper.modified button { border-color:#26a69a; }
                .cap-stepper.modified .cap-val {
                    border-color:#26a69a; background:#e0f7fa; color:#00796b;
                }
                #capacityListContainer tr.cap-weekend,
                #capacityListContainer tr.cap-weekend:nth-child(odd),
                #capacityListContainer tr.cap-weekend:nth-child(even) {
                    background-color: #fff3e0 !important;
                }
                #capacityListContainer tr.cap-weekday,
                #capacityListContainer tr.cap-weekday:nth-child(odd),
                #capacityListContainer tr.cap-weekday:nth-child(even) {
                    background-color: #ffffff !important;
                }
            </style>
            <table style="width:100%;font-size:0.9rem;border-collapse:collapse;">
            <thead><tr style="border-bottom:2px solid #e0e0e0;">
                <th style="padding:8px 6px;">Gün</th><th style="padding:8px 6px;">Tarih</th><th style="padding:8px 6px;">Tür</th>
                <th style="width:130px; text-align:center; padding:8px 6px;">Nöbetçi</th>
            </tr></thead><tbody>`;

            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                const isWeekend = isWeekendDay(d, holidays);
                const dayLabel = dayNames[d.getDay()];
                const dateStr = d.toLocaleDateString('tr-TR');
                const currentVal = tempCustomCapacities[i] !== undefined ? tempCustomCapacities[i] : dutyPerDay;
                const isModified = currentVal !== dutyPerDay;
                const rowClass = isWeekend ? 'cap-weekend' : 'cap-weekday';
                const modClass = isModified ? 'modified' : '';

                html += `<tr class="${rowClass}" style="border-bottom:1px solid #eeeeee;">
                    <td style="padding:6px 8px;"><b>${dayLabel}</b></td>
                    <td style="padding:6px 8px;">${dateStr}</td>
                    <td style="padding:6px 8px;"><span style="font-size:.78rem;color:${isWeekend ? '#f57c00' : '#26a69a'};">
                        ${isWeekend ? 'Hafta Sonu' : 'Hafta İçi'}</span></td>
                    <td style="text-align:center; padding:6px 8px;">
                        <div class="cap-stepper ${modClass}" id="stepper-${i}">
                            <button onclick="stepCapacity(${i}, -1, ${dutyPerDay})"
                                    id="btn-minus-${i}"
                                    ${currentVal <= 1 ? 'disabled' : ''}>−</button>
                            <div class="cap-val" id="capval-${i}">${currentVal}</div>
                            <button onclick="stepCapacity(${i}, +1, ${dutyPerDay})">+</button>
                        </div>
                    </td>
                </tr>`;
            }

            html += '</tbody></table>';
            document.getElementById('capacityListContainer').innerHTML = html;
        }

        function stepCapacity(dayIndex, delta, defaultVal) {
            const valEl   = document.getElementById(`capval-${dayIndex}`);
            const minusBtn = document.getElementById(`btn-minus-${dayIndex}`);
            const stepper = document.getElementById(`stepper-${dayIndex}`);

            let current = parseInt(valEl.textContent);
            const next = current + delta;

            if (next < 1) return; // 0'ın altına düşmesin

            valEl.textContent = next;
            minusBtn.disabled = (next <= 1);

            if (next === defaultVal) {
                delete tempCustomCapacities[dayIndex];
                stepper.classList.remove('modified');
            } else {
                tempCustomCapacities[dayIndex] = next;
                stepper.classList.add('modified');
            }
        }

        function updateTempCapacity(dayIndex, value, defaultVal) {
        }

        function saveCustomCapacities() {
            customDailyCapacities = Object.assign({}, tempCustomCapacities);
            const count = Object.keys(customDailyCapacities).length;
            if (count > 0) {
                M.toast({ html: `✅ ${count} gün için özel kapasite kaydedildi.`, classes: 'teal' });
            } else {
                M.toast({ html: 'Tüm günler varsayılan sayıyı kullanıyor.', classes: 'grey' });
            }
        }

        // ---- EKSİK GÜN KONTROL FONKSİYONU ----
        function checkIncompleteDays(onConfirm) {
            const { startInput, endInput, dutyPerDay } = getFormInputs();
            if (!startInput || !endInput || Object.keys(selectedCells).length === 0) {
                onConfirm();
                return;
            }
            const customCapEnabled = document.getElementById('customCapacityEnabled').checked;
            const [sd, sm, sy] = startInput.split('-').map(Number);
            const [ed, em, ey] = endInput.split('-').map(Number);
            const start = new Date(sy, sm - 1, sd);
            const end = new Date(ey, em - 1, ed);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
            const incompleteDays = [];

            for (let d = 0; d < days; d++) {
                const target = (customCapEnabled && customDailyCapacities[d] !== undefined)
                    ? customDailyCapacities[d] : dutyPerDay;
                const assigned = document.querySelectorAll(`td[data-dindex="${d}"].selected`).length;
                if (assigned < target) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    incompleteDays.push({
                        label: `${dayNames[date.getDay()]} ${date.toLocaleDateString('tr-TR')}`,
                        assigned,
                        target
                    });
                }
            }

            if (incompleteDays.length === 0) {
                onConfirm();
                return;
            }

            const listHtml = incompleteDays.map(item =>
                `<div>📅 <b>${item.label}</b> — Atanan: <b>${item.assigned}</b> / Gereken: <b>${item.target}</b></div>`
            ).join('');
            document.getElementById('incompleteDaysList').innerHTML = listHtml;

            const confirmBtn = document.getElementById('incompleteConfirmBtn');
            const newBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
            newBtn.addEventListener('click', onConfirm);

            M.Modal.getInstance(document.getElementById('incompleteWarningModal')).open();
        }

        document.addEventListener('DOMContentLoaded', function() {
            const capModal = document.getElementById('capacityModal');
            if (capModal) {
                capModal.addEventListener('modalopen', openCapacityModal);
                capModal.addEventListener('click', function() {});
            }
        });

        function saveToHistory() {
            const currentState = {
                selectedCells: JSON.parse(JSON.stringify(selectedCells)),
                unavailableCells: JSON.parse(JSON.stringify(unavailableCells))
            };
            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            history.push(currentState);
            historyIndex++;
            updateUndoRedoButtons();
        }

        function undo() {
            if (historyIndex > 0) {
                historyIndex--;
                applyState(history[historyIndex]);
                updateCalendar();
                updateStatistics();
            }
            updateUndoRedoButtons();
        }

        function redo() {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                applyState(history[historyIndex]);
                updateCalendar();
                updateStatistics();
            }
            updateUndoRedoButtons();
        }

        function applyState(state) {
            selectedCells = JSON.parse(JSON.stringify(state.selectedCells));
            unavailableCells = JSON.parse(JSON.stringify(state.unavailableCells));
        }

        function updateUndoRedoButtons() {
            document.getElementById('undoBtn').disabled = historyIndex <= 0;
            document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
        }

        function addPerson() {
            const name = normalizeName(document.getElementById('personName').value);
            if (!name) return M.toast({html: 'Lütfen isim girin!', classes: 'teal'});
            if (persons.some(p => p.name === name)) return M.toast({html: 'Bu isim zaten var!', classes: 'teal'});

            if (persons.length === 0 && (!auth || !auth.currentUser) && !loginSuggestionShown) {
                 const modalElem = document.getElementById('loginSuggestionModal');
                 if(modalElem) {
                     const instance = M.Modal.getInstance(modalElem);
                     instance.open();
                 }
                 
                 loginSuggestionShown = true; 
                 
                 return; 
            }

            persons.push({
                name: name,
                weekdayDuties: undefined,
                weekendDuties: undefined,
                minDaysBetween: 1,
                group: 0
            });

            document.getElementById('personName').value = '';
            renderTable();
            if (collapsiblePersonel) collapsiblePersonel.open(0);
            M.toast({html: `${name} eklendi!`, classes: 'teal'});
            savePersonsToLocalStorage(); // KAYDET
        }

        function deletePerson(index) {
            const name = persons[index].name;
            persons.splice(index, 1);
            renderTable();
            M.toast({html: `${name} silindi!`, classes: 'teal'});
            savePersonsToLocalStorage(); // KAYDET
        }

        function incrementDutyGap(index) {
            persons[index].minDaysBetween++;
            renderTable();
            savePersonsToLocalStorage(); // KAYDET
        }

        function decrementDutyGap(index) {
            if (persons[index].minDaysBetween > 0) {
                persons[index].minDaysBetween--;
                renderTable();
                savePersonsToLocalStorage(); // KAYDET
            }
        }

        function incrementAllDutyGaps() {
            persons.forEach(p => p.minDaysBetween++);
            renderTable();
            savePersonsToLocalStorage(); // KAYDET
        }

        function decrementAllDutyGaps() {
            persons.forEach(p => { if (p.minDaysBetween > 0) p.minDaysBetween--; });
            renderTable();
            savePersonsToLocalStorage(); // KAYDET
        }

        function toggleAvailabilityMode() {
            const switchInput = document.getElementById('modeSwitch');
            availabilityMode = !switchInput.checked;
        }

        // Cumaları Dengele / Perşembeleri Dengele birbirini exclude eder
        function onBalanceChange(changedId) {
            const otherId = changedId === 'balanceFridays' ? 'balanceThursdays' : 'balanceFridays';
            const changedEl = document.getElementById(changedId);
            const otherEl = document.getElementById(otherId);
            if (changedEl.checked && otherEl.checked) {
                otherEl.checked = false;
                const otherLabel = changedId === 'balanceFridays' ? 'Perşembeleri Dengele' : 'Cumaları Dengele';
                M.toast({ html: `"${otherLabel}" kapatıldı — ikisi aynı anda kullanılamaz.`, classes: 'teal', displayLength: 3000 });
            }
        }

        function truncateName(name) {
            if (isMobileDevice() && name.length > 8) {
                return name.substring(0, 5) + "...";
            }
            return name;
        }

        function makePersonRow(person, index, groupingEnabled, groupCount) {
            const tdS = 'height:40px;min-height:40px;max-height:40px;overflow:hidden;vertical-align:middle;line-height:40px;padding:0 10px;box-sizing:border-box;';
            const btnS = 'width:28px;height:28px;min-height:28px;max-height:28px;line-height:28px;font-size:12px;margin:0 4px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:background-color 0.2s;overflow:hidden;';
            const iconS = 'line-height:28px;font-size:14px;margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:28px;width:28px;color:#ffffff;';
            const inputS = 'height:28px;min-height:28px;max-height:28px;line-height:28px;font-size:13px;margin:0;padding:0 6px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:4px;background-color:#ffffff;transition:border-color 0.2s;outline:none;overflow:hidden;';
            let groupOptions = '<option value="0">Seç</option>';
            for (let i = 1; i <= groupCount; i++) {
                groupOptions += `<option value="${i}" ${person.group === i ? 'selected' : ''}>${i}</option>`;
            }
            const groupTd = groupingEnabled && groupCount > 0 ? `<td style="${tdS}"><select style="height:28px;font-size:13px;border:1px solid #d1d5db;border-radius:4px;padding:0 4px;min-width:${isMobileDevice() ? '50px' : '30px'};display:block;" onchange="updateGroup(${index}, this.value)">${groupOptions}</select></td>` : '';
            return `<tr style="height:40px;min-height:40px;max-height:40px;overflow:hidden;background-color:#f9fafb;transition:background-color 0.2s;">
                ${groupTd}
                <td style="${tdS}font-family:'Arial',sans-serif;color:#374151;">${truncateName(person.name)}</td>
                <td style="${tdS}"><input type="number" class="planning-input" min="0" value="${person.weekdayDuties === undefined ? '' : person.weekdayDuties}" onchange="updateDuty(${index}, 'weekdayDuties', this.value)" style="${inputS}"></td>
                <td style="${tdS}"><input type="number" class="planning-input" min="0" value="${person.weekendDuties === undefined ? '' : person.weekendDuties}" onchange="updateDuty(${index}, 'weekendDuties', this.value)" style="${inputS}"></td>
                <td class="duty-gap-cell" style="${tdS}">
                    <span style="margin-right:8px;font-size:13px;line-height:28px;height:28px;display:inline-block;color:#4b5563;">${person.minDaysBetween}</span>
                    <a class="btn-floating btn-small waves-effect waves-light" onclick="decrementDutyGap(${index})" style="${btnS}background-color:#10b981;"><i class="material-icons" style="${iconS}">arrow_downward</i></a>
                    <a class="btn-floating btn-small waves-effect waves-light" onclick="incrementDutyGap(${index})" style="${btnS}background-color:#10b981;"><i class="material-icons" style="${iconS}">arrow_upward</i></a>
                </td>
                <td class="left-align" style="${tdS}">
                    <a class="btn-floating btn-small" onclick="deletePerson(${index})" style="${btnS}background-color:#ef4444;"><i class="material-icons" style="${iconS}">delete</i></a>
                </td>
            </tr>`;
        }

        function buildCalendarHTML(dates, persons, start, days) {
            let html = '<tr><th class="name-column">İsim</th>';
            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                html += `<th>${d.getDate()}</th>`;
            }
            html += '</tr>';
            persons.forEach((person, pIndex) => {
                html += `<tr><td class="name-column">${truncateName(person.name)}</td>`;
                dates.forEach((dateObj, dIndex) => {
                    const cellKey = `${pIndex}-${dIndex}`;
                    html += `<td class="calendar-cell ${dateObj.isWeekend ? 'holiday' : ''} ${unavailableCells[cellKey] ? 'unavailable' : ''} ${selectedCells[cellKey] ? 'selected' : ''}" data-pindex="${pIndex}" data-dindex="${dIndex}"></td>`;
                });
                html += '</tr>';
            });
            return html;
        }

       function renderTable() {
            const tableContainer = document.getElementById('personnelTableContainer');
            const noPersonnelMessage = document.getElementById('noPersonnelMessage');
            const groupingSwitch = document.getElementById('groupingSwitch');
            const groupingEnabled = document.getElementById('groupingCheckbox').checked;
            const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value.trim()) || 0;
        
            if (dutyPerDay >= 2) {
                groupingSwitch.style.display = 'block';
            } else {
                groupingSwitch.style.display = 'none';
                document.getElementById('groupingCheckbox').checked = false;
            }
        
            if (persons.length === 0) {
                tableContainer.style.display = 'none';
                noPersonnelMessage.style.display = 'block';
            } else {
                tableContainer.style.display = 'table';
                noPersonnelMessage.style.display = 'none';
        
                let html = `
                    <thead>
                        <tr>
                            ${groupingEnabled ? '<th style="background-color: #f2f2f2;">Grup</th>' : ''}
                            <th style="background-color: #f2f2f2;">İsim</th>
                            <th style="background-color: #f2f2f2;">Hafta İçi</th>
                            <th style="background-color: #f2f2f2;">Hf Sonu</th>
                            <th class="duty-gap-header" style="background-color: #f2f2f2;">
                                ${isMobileDevice() ? '2 Nöbet<br>Arası Boşluk(gün)' : '2 Nöbet Arası Boşluk(gün)'}
                                <a class="btn-floating btn-small waves-effect waves-light teal decrement-btn" onclick="decrementAllDutyGaps()">
                                    <i class="material-icons">arrow_downward</i>
                                </a>
                                <a class="btn-floating btn-small waves-effect waves-light teal increment-btn" onclick="incrementAllDutyGaps()">
                                    <i class="material-icons">arrow_upward</i>
                                </a>
                            </th>
                            <th style="background-color: #f2f2f2; text-align: center;">Sil</th>
                        </tr>
                    </thead>
                    <tbody id="personTable">
                `;
        
                const groupCount = Math.ceil(persons.length / 2);
        
                persons.forEach((person, index) => {
                    html += makePersonRow(person, index, groupingEnabled, groupCount);
                });
        
                html += `</tbody>`;
                tableContainer.innerHTML = html;
        
                const selects = tableContainer.querySelectorAll('select');
                selects.forEach(select => {
                    select.style.display = 'block';
                    select.removeAttribute('data-m-select');
                    if (select.M_FormSelect) {
                        select.M_FormSelect.destroy();
                    }
                });
            }
        }

        function toggleGrouping() {
            renderTable();
        }

        function updateGroup(index, value) {
            persons[index].group = parseInt(value);
            renderTable();
            savePersonsToLocalStorage(); // KAYDET
        }

        function updateDuty(index, type, value) {
            if (value === "" || value === null) {
                persons[index][type] = undefined;
            } else {
                persons[index][type] = parseInt(value) || 0;
            }
            savePersonsToLocalStorage(); // KAYDET
        }

        function resetDuties() {
            persons.forEach(person => {
                person.weekdayDuties = undefined;
                person.weekendDuties = undefined;
            });
            renderTable();
            if (collapsibleCalendar) collapsibleCalendar.close(0);
            document.getElementById('calendarTable').innerHTML = '';
            M.toast({html: 'Nöbet dağıtımı ve takvim sıfırlandı!'});
            savePersonsToLocalStorage(); // KAYDET
        }

       function showCustomAlert() {
            const existingAlert = document.querySelector('#calendarAlert');
            if (existingAlert) existingAlert.remove();
        
            const alertDiv = document.createElement('div');
            alertDiv.id = 'calendarAlert';
            alertDiv.className = 'card';
            alertDiv.setAttribute('role', 'alert');
            alertDiv.setAttribute('aria-live', 'assertive');
            alertDiv.style.position = 'fixed';
            alertDiv.style.width = '90%';
            alertDiv.style.maxWidth = '400px';
            alertDiv.style.zIndex = '10001';
            alertDiv.style.backgroundColor = 'rgba(245, 233, 217, 0.9)'; 
            alertDiv.style.backdropFilter = 'blur(8px)'; 
            alertDiv.style.webkitBackdropFilter = 'blur(8px)';
            alertDiv.style.border = '2px solid #26a69a';
            alertDiv.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.3)';
            alertDiv.style.borderRadius = '8px';
        
            if (isMobileDevice()) {
                alertDiv.style.top = '35%';
                alertDiv.style.left = '50%';
                alertDiv.style.transform = 'translateX(-50%)';
                if (window.innerWidth < 360) {
                    alertDiv.style.maxWidth = '280px';
                }
            } else {
                alertDiv.style.top = '50%';
                alertDiv.style.left = '50%';
                alertDiv.style.transform = 'translate(-50%, -50%)';
            }
        
            alertDiv.innerHTML = `
                <div class="card-content center-align" style="padding: 12px; color: #000000;">
                    <span style="font-weight: bold; font-size: 1rem; display: block; margin-bottom: 8px;" 
                          aria-label="Takvim oluşturuldu. Nöbetler dengeli dağıtıldı. Dağıtımı değiştirebilir veya takvimde seçim yaparak Otomatik Ata butonuna basabilirsiniz.">
                        Takvim oluşturuldu ve NÖBET SAYILARI dengeli dağıtıldı!<br>
                        Bu dağıtımı kendiniz de değiştirebilirsiniz!<br>
                        Ardından takvimde sol alttaki switch butonuyla "İstenen/İstenmeyen Gün" seçimlerinizi yaparak <span style="color: #e040fb;">‘Otomatik Ata’</span> tuşuna basınız.
                    </span>
                </div>
                <div style="display: flex; justify-content: center; padding-bottom: 8px;">
                    <a class="btn-floating teal bounce" style="width: 40px; height: 40px; line-height: 40px;">
                        <i class="material-icons" style="font-size: 30px; line-height: 40px; color: white;">arrow_downward</i>
                    </a>
                </div>
            `;
        
            document.body.appendChild(alertDiv);
        
            const bounceButton = alertDiv.querySelector('.btn-floating.bounce');
            let timeoutId = setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.style.opacity = '0';
                    alertDiv.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        if (alertDiv.parentNode) alertDiv.remove();
                    }, 800);
                }
            }, 8000);
        
            bounceButton.addEventListener('click', () => {
                clearTimeout(timeoutId);
                bounceButton.classList.remove('bounce'); // Animasyonu durdur
                const calendarContainer = document.getElementById('calendarContainer');
                calendarContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                alertDiv.remove();
            });
        
            const closeOnOutsideClick = (event) => {
                if (!alertDiv.contains(event.target)) {
                    clearTimeout(timeoutId);
                    bounceButton.classList.remove('bounce'); // Animasyonu durdur
                    alertDiv.style.opacity = '0';
                    alertDiv.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        if (alertDiv.parentNode) alertDiv.remove();
                    }, 800);
                    document.removeEventListener('click', closeOnOutsideClick);
                }
            };
        
            setTimeout(() => {
                document.addEventListener('click', closeOnOutsideClick);
            }, 100);
        }

        function addGlowEffect() {
            
            const inputs = document.querySelectorAll('#personTable input[type="number"]');
            inputs.forEach(input => {
                
                input.classList.add('glow');
            
                setTimeout(() => {
                    input.classList.remove('glow');
                }, 8000);
            });
        }

        function generateCalendar() {

            if (persons.length < 3) {
                M.toast({ html: 'Lütfen en az 3 personel ekleyin!', classes: 'purple' });
                return;
            }
            
            const startInput = document.getElementById('startDate').value;
            const endInput = document.getElementById('endDate').value;
            const dutyPerDayInput = document.getElementById('dutyPerDay').value.trim();

            if (!dutyPerDayInput || dutyPerDayInput === "") {
                M.toast({ html: 'Kaçar kişinin nöbetçi olacağını belirleyiniz!', classes: 'purple' });
                return;
            }

            const dutyPerDay = parseInt(dutyPerDayInput);
            if (isNaN(dutyPerDay) || dutyPerDay < 1) {
                M.toast({ html: 'Lütfen geçerli bir sayı girin (1 veya daha fazla)!', classes: 'purple' });
                return;
            }

            if (!startInput || !endInput) {
                M.toast({ html: 'Lütfen tarih seçin!', classes: 'purple' });
                return;
            }

            const start = parseDate(startInput);
            const end = parseDate(endInput);

            const holidays = getHolidays();

            selectedCells = {};
            history = [];
            historyIndex = -1;
            saveToHistory();

            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            const dates = [];
            let weekendDays = 0;
            let weekdayDays = 0;
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                const isWeekend = isWeekendDay(date, holidays);
                dates.push({ date: date.toISOString(), isWeekend });
                if (isWeekend) weekendDays++;
                else weekdayDays++;
            }

            const customCapEnabled = document.getElementById('customCapacityEnabled').checked;

            let totalDuties = 0;
            let totalWeekendDuties = 0;
            let totalWeekdayDuties = 0;
            for (let i = 0; i < days; i++) {
                const cap = (customCapEnabled && customDailyCapacities[i] !== undefined)
                    ? customDailyCapacities[i]
                    : dutyPerDay;
                totalDuties += cap;
                if (dates[i] && dates[i].isWeekend) totalWeekendDuties += cap;
                else totalWeekdayDuties += cap;
            }

            let preplannedWeekendDuties = 0;
            let preplannedWeekdayDuties = 0;
            persons.forEach(person => {
                if (person.weekendDuties !== undefined) preplannedWeekendDuties += person.weekendDuties;
                if (person.weekdayDuties !== undefined) preplannedWeekdayDuties += person.weekdayDuties;
            });

            const adjustedTotalDuties = totalDuties - (preplannedWeekendDuties + preplannedWeekdayDuties);
            const adjustedWeekendDuties = totalWeekendDuties - preplannedWeekendDuties;
            const adjustedWeekdayDuties = totalWeekdayDuties - preplannedWeekdayDuties;

            const unplannedPersons = persons.filter(p => p.weekdayDuties === undefined && p.weekendDuties === undefined);
            const shuffledUnplanned = shuffleArray([...unplannedPersons]);
            const unplannedCount = unplannedPersons.length;

            const avgDutiesPerPerson = unplannedCount ? Math.floor(adjustedTotalDuties / unplannedCount) : 0;
            const extraTotalDuties = unplannedCount ? adjustedTotalDuties % unplannedCount : 0;
            const avgWeekendPerPerson = unplannedCount ? Math.floor(adjustedWeekendDuties / unplannedCount) : 0;
            const extraWeekendDuties = unplannedCount ? adjustedWeekendDuties % unplannedCount : 0;

            let personDutyAssignments = persons.map(person => {
                if (person.weekdayDuties !== undefined || person.weekendDuties !== undefined) {
                    return {
                        person,
                        totalDuties: (person.weekdayDuties || 0) + (person.weekendDuties || 0),
                        weekendDuties: person.weekendDuties || 0,
                        weekdayDuties: person.weekdayDuties || 0
                    };
                }
                return null;
            }).filter(p => p !== null);

            shuffledUnplanned.forEach((person, index) => {
                personDutyAssignments.push({
                    person,
                    totalDuties: avgDutiesPerPerson + (index < extraTotalDuties ? 1 : 0),
                    weekendDuties: avgWeekendPerPerson + (index < extraWeekendDuties ? 1 : 0),
                    weekdayDuties: 0
                });
            });

            personDutyAssignments.forEach(assignment => {
                if (assignment.person.weekdayDuties === undefined) {
                    assignment.weekdayDuties = assignment.totalDuties - assignment.weekendDuties;
                }
            });

            personDutyAssignments.forEach(assignment => {
                const originalPerson = persons.find(p => p.name === assignment.person.name);
                originalPerson.weekdayDuties = assignment.weekdayDuties;
                originalPerson.weekendDuties = assignment.weekendDuties;
            });

            renderTable();

            let html = '<tr><th class="name-column">İsim</th>';
            html += buildCalendarHTML(dates, persons, start, days);

            document.getElementById('calendarTable').innerHTML = html;

            const cells = document.querySelectorAll('.calendar-cell');
            const isMobile = isMobileDevice();
        
            cells.forEach(cell => {
                if (!isMobile) {
                    cell.addEventListener('mousedown', startDragging);
                    cell.addEventListener('mousemove', dragOver);
                    cell.addEventListener('mouseup', stopDragging);
                    cell.addEventListener('touchstart', startDragging, { passive: false });
                    cell.addEventListener('touchmove', dragOver, { passive: false });
                    cell.addEventListener('touchend', stopDragging);
                }
                
                cell.addEventListener('click', () => {
                    const pIndex = parseInt(cell.dataset.pindex);
                    const dIndex = parseInt(cell.dataset.dindex);
                    handleCellClick(pIndex, dIndex);
                });
                
                if (isMobile) {
                    cell.addEventListener('touchend', (event) => {
                        event.preventDefault();
                        const pIndex = parseInt(cell.dataset.pindex);
                        const dIndex = parseInt(cell.dataset.dindex);
                        handleCellClick(pIndex, dIndex);
                    }, { passive: false });
                }
            });
        
            if (collapsibleCalendar) collapsibleCalendar.open(0);
            showCustomAlert();
            addGlowEffect();
            updateStatistics();
        }

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        function startDragging(event) {
            const cell = event.target;
            const pIndex = parseInt(cell.dataset.pindex);
            const dIndex = parseInt(cell.dataset.dindex);
            dragStart = { pIndex, dIndex };
            isDragging = true;
            event.preventDefault();
        }

        function dragOver(event) {
            if (!isDragging || !dragStart) return;

            const cell = event.target;
            if (!cell.classList.contains('calendar-cell')) return;

            const pIndex = parseInt(cell.dataset.pindex);
            const dIndex = parseInt(cell.dataset.dindex);
            const cellKey = `${pIndex}-${dIndex}`;

            cell.classList.remove('dragging');

            const dragColor = availabilityMode ? 'rgba(255, 182, 193, 0.8)' : 'rgba(200, 230, 201, 0.8)';
            cell.style.backgroundColor = dragColor;

            cell.classList.add('dragging');
            event.preventDefault();
        }

        function stopDragging(event) {
            if (!isDragging || !dragStart) return;

            const cells = document.querySelectorAll('.calendar-cell.dragging');
            const totalDays = document.querySelectorAll('th').length - 1;
            saveToHistory();

            let hasConsecutive = false;
            const tempSelected = [...cells].map(cell => {
                const pIndex = parseInt(cell.dataset.pindex);
                const dIndex = parseInt(cell.dataset.dindex);
                return `${pIndex}-${dIndex}`;
            });

            tempSelected.forEach(cellKey => {
                const [pIndex, dIndex] = cellKey.split('-').map(Number);
                const prevDay = dIndex - 1;
                const nextDay = dIndex + 1;
                const prevCellKey = `${pIndex}-${prevDay}`;
                const nextCellKey = `${pIndex}-${nextDay}`;

                if ((prevDay >= 0 && (selectedCells[prevCellKey] || tempSelected.includes(prevCellKey))) ||
                    (nextDay < totalDays && (selectedCells[nextCellKey] || tempSelected.includes(nextCellKey)))) {
                    hasConsecutive = true;
                }
            });

            if (!availabilityMode && hasConsecutive) {
                M.toast({ html: 'Seçilen günlerde üst üste nöbet ataması tespit edildi!' });
            }

            cells.forEach(cell => {
                const pIndex = parseInt(cell.dataset.pindex);
                const dIndex = parseInt(cell.dataset.dindex);
                const cellKey = `${pIndex}-${dIndex}`;

                if (availabilityMode) {
                    unavailableCells[cellKey] = !unavailableCells[cellKey];
                    cell.classList.toggle('unavailable', unavailableCells[cellKey]);
                    if (unavailableCells[cellKey]) {
                        delete selectedCells[cellKey];
                        cell.classList.remove('selected');
                    }
                } else {
                    if (!unavailableCells[cellKey] && !selectedCells[cellKey]) {
                        selectedCells[cellKey] = true;
                        cell.classList.add('selected');
                    }
                }
                cell.classList.remove('dragging');
                cell.style.backgroundColor = '';
            });

            checkScheduleValidity();
            updateStatistics();
            isDragging = false;
            dragStart = null;
        }

       let isFirstClick = true; // İlk tıklamayı takip etmek için global değişken

        function handleCellClick(pIndex, dIndex) {
            const cellKey = `${pIndex}-${dIndex}`;
            const cell = document.querySelector(`td[data-pindex="${pIndex}"][data-dindex="${dIndex}"]`);
        
            if (isFirstClick && isMobileDevice() && window.innerWidth < window.innerHeight) {
                if (navigator.vibrate) {
                    navigator.vibrate(200); // 200ms titreşim
                }
        
                M.Toast.dismissAll();
                const toastHTML = '<span style="font-size: 1rem;">Takvim işaretlemeleri için yatay moda almanız önerilir</span>';
                const toast = M.toast({
                    html: toastHTML,
                    displayLength: 6000,
                    classes: 'shake' // Sallanma animasyonu için sınıf
                });
        
                setTimeout(() => {
                    const toastElement = document.querySelector('.toast');
                    if (toastElement) {
                        toastElement.classList.add('shake');
                    }
                }, 0);
        
                isFirstClick = false;
            }
        
            saveToHistory();
        
            if (availabilityMode) {
                unavailableCells[cellKey] = !unavailableCells[cellKey];
                cell.classList.toggle('unavailable', unavailableCells[cellKey]);
                if (unavailableCells[cellKey]) {
                    delete selectedCells[cellKey];
                    cell.classList.remove('selected');
                }
            } else {
                if (!unavailableCells[cellKey]) {
                    if (selectedCells[cellKey]) {
                        delete selectedCells[cellKey];
                        cell.classList.remove('selected');
                    } else {
                        const prevDay = dIndex - 1;
                        const nextDay = dIndex + 1;
                        const prevCellKey = `${pIndex}-${prevDay}`;
                        const nextCellKey = `${pIndex}-${nextDay}`;
                        const totalDays = document.querySelectorAll('th').length - 1;
        
                        if ((prevDay >= 0 && selectedCells[prevCellKey]) || (nextDay < totalDays && selectedCells[nextCellKey])) {
                            M.toast({ html: `${persons[pIndex].name} için üst üste nöbet ataması tespit edildi!` });
                        }
        
                        selectedCells[cellKey] = true;
                        cell.classList.add('selected');
                    }
                }
            }
            checkScheduleValidity();
            updateStatistics();
        }

       function updateStatistics() {
            const { startInput, endInput } = getFormInputs();
            if (!startInput || !endInput) return;
            const start = parseDate(startInput);
            const end = parseDate(endInput);
        
            const holidays = getHolidays();
            const leaveChecked = document.getElementById('leaveCheckbox').checked;
        
            const stats = persons.map(p => ({name: p.name, weekday: 0, weekend: 0, thursday: 0, friday: 0, overtime: 0}));
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
            for (let d = 0; d < days; d++) {
                const date = new Date(start);
                date.setDate(date.getDate() + d);
                const isWeekend = isWeekendDay(date, holidays);
                const isSaturday = date.getDay() === 6;
                const isSunday = date.getDay() === 0;
                const isThursday = date.getDay() === 4;
                const isFriday = date.getDay() === 5;
        
                persons.forEach((person, pIndex) => {
                    if (selectedCells[`${pIndex}-${d}`]) {
                        if (isWeekend) {
                            stats[pIndex].weekend++;
                            if (leaveChecked) {
                                if (isSaturday) {
                                    stats[pIndex].overtime += 24; 
                                } else {
                                    stats[pIndex].overtime += 16; 
                                }
                            } else {
                                stats[pIndex].overtime += 24; 
                            }
                        } else {
                            stats[pIndex].weekday++;
                            if (isFriday) {
                                stats[pIndex].friday++;
                                stats[pIndex].overtime += leaveChecked ? 16 : 16; 
                            } else if (isThursday) {
                                stats[pIndex].thursday++;
                                stats[pIndex].overtime += leaveChecked ? 8 : 16; 
                            } else {
                                stats[pIndex].overtime += leaveChecked ? 8 : 16; 
                            }
                        }
                    }
                });
            }
        
            const html = stats.map(stat => `
                <tr>
                    <td>${stat.name}</td>
                    <td>${stat.weekday}</td>
                    <td>${stat.weekend}</td>
                    <td>${stat.thursday}</td>
                    <td>${stat.friday}</td>
                    <td>${stat.weekday + stat.weekend}</td>
                    <td>${stat.overtime}</td>
                </tr>
            `).join('');
        
            document.getElementById('statsTable').innerHTML = html;
            if (statsCollapsible) statsCollapsible.open(0);
        }

        function checkScheduleValidity() {
            validationErrors = [];
            const { startInput, endInput, dutyPerDay } = getFormInputs();
            if (!startInput || !endInput) return;
            const customCapEnabled = document.getElementById('customCapacityEnabled').checked;
            const start = parseDate(startInput);
            const end = parseDate(endInput);
            const days = daysBetween(startInput, endInput);

            function getDayTarget(d) {
                return (customCapEnabled && customDailyCapacities[d] !== undefined)
                    ? customDailyCapacities[d]
                    : dutyPerDay;
            }

            for (let d = 0; d < days; d++) {
                const target = getDayTarget(d);
                const assigned = document.querySelectorAll(`td[data-dindex="${d}"].selected`).length;
                if (assigned < target) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    validationErrors.push({
                        type: 'error',
                        message: `${date.toLocaleDateString('tr-TR')} tarihine ${target} nöbetçi atanmamış, atanan: ${assigned}`
                    });
                }
            }

            for (let d = 0; d < days; d++) {
                const target = getDayTarget(d);
                const assigned = [];
                document.querySelectorAll(`td[data-dindex="${d}"].selected`).forEach(td => {
                    assigned.push(td.closest('tr').querySelector('td:first-child').innerText);
                });
                if (assigned.length > target) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    validationErrors.push({
                        type: 'warning',
                        message: `${date.toLocaleDateString('tr-TR')} tarihinde fazla atama: ${assigned.join(', ')} (${assigned.length} > ${target})`
                    });
                }
            }

            persons.forEach((person, pIndex) => {
                const duties = [];
                for (let d = 0; d < days; d++) {
                    if (selectedCells[`${pIndex}-${d}`]) duties.push(d);
                }
                for (let i = 1; i < duties.length; i++) {
                    if (duties[i] - duties[i-1] === 1) {
                        const date1 = new Date(start);
                        date1.setDate(date1.getDate() + duties[i-1]);
                        const date2 = new Date(start);
                        date2.setDate(date2.getDate() + duties[i]);
                        validationErrors.push({
                            type: 'warning',
                            message: `${person.name} üst üste nöbet: ${date1.toLocaleDateString('tr-TR')} - ${date2.toLocaleDateString('tr-TR')}`
                        });
                    }
                }
            });

            Object.keys(selectedCells).forEach(key => {
                if (selectedCells[key] && unavailableCells[key]) {
                    const [pIndex, dIndex] = key.split('-');
                    const person = persons[pIndex].name;
                    const date = new Date(start);
                    date.setDate(date.getDate() + parseInt(dIndex));
                    validationErrors.push({
                        type: 'error',
                        message: `${person} istenmeyen günde nöbet: ${date.toLocaleDateString('tr-TR')}`
                    });
                }
            });

            persons.forEach((person, index) => {
                const plannedWeekday = person.weekdayDuties;
                const plannedWeekend = person.weekendDuties;
                const stats = updateStatsForPerson(index);
                const actualWeekday = stats.weekday;
                const actualWeekend = stats.weekend;
                if (plannedWeekday !== undefined && plannedWeekday > 0 && actualWeekday !== plannedWeekday) {
                    validationErrors.push({
                        type: 'warning',
                        message: `${person.name}: Planlanan hafta içi nöbet (${plannedWeekday}), atanan nöbet (${actualWeekday})`
                    });
                }
                if (plannedWeekend !== undefined && plannedWeekend > 0 && actualWeekend !== plannedWeekend) {
                    validationErrors.push({
                        type: 'warning',
                        message: `${person.name}: Planlanan hafta sonu nöbet (${plannedWeekend}), atanan nöbet (${actualWeekend})`
                    });
                }
            });
        }

        function updateStatsForPerson(pIndex) {
            const startInput = document.getElementById('startDate').value;
            const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            start.setHours(0, 0, 0, 0);

            const holidays = getHolidays();

            const days = Math.ceil((new Date(document.getElementById('endDate').value.split('-').reverse().join('-')) - start) / (1000 * 60 * 60 * 24)) + 1;
            let weekday = 0, weekend = 0;

            for (let d = 0; d < days; d++) {
                const date = new Date(start);
                date.setDate(date.getDate() + d);
                const isWeekend = isWeekendDay(date, holidays);
                if (selectedCells[`${pIndex}-${d}`]) {
                    if (isWeekend) weekend++;
                    else weekday++;
                }
            }
            return { weekday, weekend };
        }

        function showErrorModal() {
            const errorList = document.getElementById('errorList');
            errorList.innerHTML = validationErrors.map(error => `
                <div class="error-item">
                    <span class="${error.type === 'error' ? 'error-type' : 'warning-type'}">
                        ${error.type === 'error' ? 'HATA' : 'UYARI'}:
                    </span>
                    ${error.message}
                </div>
            `).join('');
            const modal = M.Modal.init(document.getElementById('errorModal'));
            modal.open();
        }

        function confirmSend() {
            performExport();
        }

        function sendSchedule() {
            checkScheduleValidity();
            updateStatistics();
            if (validationErrors.length > 0) {
                showErrorModal();
            } else {
                M.toast({ html: 'Lütfen bir paylaşım seçeneği seçin!', classes: 'blue' });
            }
        }

       function performExport(callback) {
            const { startInput, endInput, dutyPerDay: rawD } = getFormInputs();
            const dutyPerDay = rawD || 1;
            if (!startInput || !endInput) {
                M.toast({ html: 'Lütfen tarih seçin!' });
                return;
            }
        
            const start = parseDate(startInput);
            const end = parseDate(endInput);
        
            const holidays = getHolidays();
        
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const scheduleData = {};
        
            for (let d = 0; d < days; d++) {
                const currentDate = new Date(start);
                currentDate.setDate(currentDate.getDate() + d);
                const dateStr = currentDate.toLocaleDateString('tr-TR');
                scheduleData[dateStr] = [];
                document.querySelectorAll(`td[data-dindex="${d}"].selected`).forEach(td => {
                    const person = td.closest('tr').querySelector('td:first-child').innerText;
                    scheduleData[dateStr].push(person);
                });
            }
        
            let maxAssignedPerDay = 0;
            for (const date in scheduleData) {
                const assignedCount = scheduleData[date].length;
                maxAssignedPerDay = Math.max(maxAssignedPerDay, assignedCount);
            }
            const columnCount = Math.max(dutyPerDay, maxAssignedPerDay);
        
            const styledData = [];
        
            const headers = [{ v: 'Tarih', t: 's', s: { font: { bold: true, sz: 16 } } }];
            for (let i = 1; i <= columnCount; i++) {
                headers.push({ v: `Nöbetçi ${i}`, t: 's', s: { font: { bold: true, sz: 16 } } });
            }
            styledData.push(headers);
        
            for (let d = 0; d < days; d++) {
                const currentDate = new Date(start);
                currentDate.setDate(currentDate.getDate() + d);
                const dateStr = currentDate.toLocaleDateString('tr-TR');
                const isWeekend = isWeekendDay(currentDate, null);
                const isHoliday = holidays.includes(currentDate.getDate());
        
                let dateStyle = { font: { bold: true, sz: 16 } }; 
                if (isWeekend && !isHoliday) {
                    dateStyle.fill = { fgColor: { rgb: "808080" } }; 
                }
                if (isHoliday) {
                    dateStyle = {
                        fill: { fgColor: { rgb: "808080" } }, 
                        font: { bold: true, sz: 16, color: { rgb: "FF0000" } } 
                    };
                }
                if (isWeekend && isHoliday) {
                    dateStyle = {
                        fill: { fgColor: { rgb: "808080" } }, 
                        font: { bold: true, sz: 16, color: { rgb: "FF0000" } } 
                    };
                }
        
                const row = [{ v: dateStr, t: 's', s: dateStyle }]; 
                const assigned = scheduleData[dateStr] || [];
                for (let i = 0; i < columnCount; i++) {
                    row.push({ v: assigned[i] || '', t: 's', s: { font: { sz: 16 } } }); 
                }
                styledData.push(row);
            }
        
            const ws = XLSX.utils.aoa_to_sheet(styledData);
        
            ws['!cols'] = [
                { wch: 14 }, 
                ...Array(columnCount).fill({ wch: 22 }) 
            ];
        
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Nöbet Listesi");
        
            const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
            const fileName = `nobet_listesi_${new Date().toISOString().split('T')[0]}.xlsx`;
        
            if (callback) callback(blob, fileName);
        }
        
        function downloadSchedule() {
            const startInput = document.getElementById('startDate').value;
            if (!startInput || Object.keys(selectedCells).length === 0) {
                M.toast({ html: 'İndirilecek bir takvim yok! Önce takvimi oluşturun.', classes: 'red' });
                return;
            }

            checkIncompleteDays(function() {
                performExport(function(blob, fileName) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('Dosya cihazınıza indi! 📂 Buluta kayıt işlemi başlatılıyor...', 4000);
                    saveScheduleToHistory();
                });
            });
        }
        function autoAssignDuties() {
            validationErrors = [];
            if (!document.getElementById('calendarTable').innerHTML) {
                M.toast({ html: 'Önce takvim oluşturun!' });
                return;
            }

            const startInput = document.getElementById('startDate').value;
            const endInput = document.getElementById('endDate').value;
            const dutyPerDayInput = document.getElementById('dutyPerDay').value.trim();

            if (!dutyPerDayInput || dutyPerDayInput === "") {
                M.toast({ html: 'inin nöbetçi olacağını belirleyiniz!' });
                return;
            }

            const dutyPerDay = parseInt(dutyPerDayInput);
            if (isNaN(dutyPerDay) || dutyPerDay < 1) {
                M.toast({ html: 'Lütfen geçerli bir sayı girin (1 veya daha fazla)!' });
                return;
            }

            if (!startInput || !endInput) {
                M.toast({ html: 'Lütfen tarih seçin!' });
                return;
            }

            const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
            const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            const end = new Date(endYear, endMonth - 1, endDay);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const holidays = getHolidays();

            const dates = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                const isWeekend = isWeekendDay(date, holidays);
                const isFriday = date.getDay() === 5;
                const isThursday = date.getDay() === 4;
                dates.push({ index: i, isWeekend, isFriday, isThursday });
            }

            for (let d = 0; d < days; d++) {
                let unavailableCount = 0;
                for (let p = 0; p < persons.length; p++) {
                    const cellKey = `${p}-${d}`;
                    if (unavailableCells[cellKey]) {
                        unavailableCount++;
                    }
                }
                if (unavailableCount === persons.length) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    const dateStr = date.toLocaleDateString('tr-TR');
                    M.toast({ html: `${dateStr} gününe müsait personel bırakmalısınız!`, displayLength: 8000 });
                    return;
                }
            }

            const customCapEnabled = document.getElementById('customCapacityEnabled').checked;

            for (let d = 0; d < days; d++) {
                let selectedCount = 0;
                for (let p = 0; p < persons.length; p++) {
                    const cellKey = `${p}-${d}`;
                    if (selectedCells[cellKey]) {
                        selectedCount++;
                    }
                }
                const dayCapCheck = (customCapEnabled && customDailyCapacities[d] !== undefined)
                    ? customDailyCapacities[d] : dutyPerDay;
                if (selectedCount > dayCapCheck) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    const dateStr = date.toLocaleDateString('tr-TR');
                    M.toast({ html: `${dateStr} gününe fazla nöbetçi yazdınız! Beklenen: ${dayCapCheck}, Atanan: ${selectedCount}`, displayLength: 8000 });
                    return;
                }
            }

            function getDayCap(d) {
                return (customCapEnabled && customDailyCapacities[d] !== undefined)
                    ? customDailyCapacities[d]
                    : dutyPerDay;
            }

            let totalExpectedDuties = 0;
            let expectedWeekdayDuties = 0;
            let expectedWeekendDuties = 0;
            for (let d = 0; d < days; d++) {
                const cap = getDayCap(d);
                totalExpectedDuties += cap;
                if (dates[d].isWeekend) expectedWeekendDuties += cap;
                else expectedWeekdayDuties += cap;
            }

            let totalPlannedDuties = 0;
            let plannedWeekdayDuties = 0;
            let plannedWeekendDuties = 0;

            persons.forEach(person => {
                plannedWeekdayDuties += person.weekdayDuties || 0;
                plannedWeekendDuties += person.weekendDuties || 0;
                totalPlannedDuties += (person.weekdayDuties || 0) + (person.weekendDuties || 0);
            });

            if (totalPlannedDuties !== totalExpectedDuties || 
                plannedWeekdayDuties !== expectedWeekdayDuties || 
                plannedWeekendDuties !== expectedWeekendDuties) {
                const weekdayDiff = plannedWeekdayDuties - expectedWeekdayDuties;
                const weekendDiff = plannedWeekendDuties - expectedWeekendDuties;
                let customMessage = "";

                if (totalPlannedDuties > totalExpectedDuties) {
                    customMessage = "Fazla nöbet yazdınız! ";
                    if (weekdayDiff > 0) customMessage += `${weekdayDiff} miktar hafta içini azaltın`;
                    if (weekendDiff > 0) customMessage += `${weekdayDiff > 0 && weekendDiff > 0 ? ' ve ' : ''}${weekendDiff} miktar hafta sonunu azaltın`;
                    customMessage += ".";
                } else if (totalPlannedDuties < totalExpectedDuties) {
                    customMessage = "Az nöbet yazdınız! ";
                    if (weekdayDiff < 0) customMessage += `${Math.abs(weekdayDiff)} miktar hafta içini artırın`;
                    if (weekendDiff < 0) customMessage += `${weekdayDiff < 0 && weekendDiff < 0 ? ' ve ' : ''}${Math.abs(weekendDiff)} miktar hafta sonunu artırın`;
                    customMessage += ".";
                } else {
                    customMessage = "Nöbet dağılımı uyumsuz! ";
                    if (weekdayDiff > 0) customMessage += `${weekdayDiff} miktar hafta içini azaltın`;
                    if (weekendDiff < 0) customMessage += `${weekdayDiff > 0 ? ' ve ' : ''}${Math.abs(weekendDiff)} miktar hafta sonunu artırın`;
                    if (weekendDiff > 0) customMessage += `${weekdayDiff > 0 || weekendDiff < 0 ? ' ve ' : ''}${weekendDiff} miktar hafta sonunu azaltın`;
                    if (weekdayDiff < 0) customMessage += `${weekendDiff > 0 || weekdayDiff > 0 ? ' ve ' : ''}${Math.abs(weekdayDiff)} miktar hafta içini artırın`;
                    customMessage += ".";
                }

                M.toast({ html: customMessage, displayLength: 8000 });
                return;
            }

            const personnelDuties = persons.map(person => ({
                name: person.name,
                weekdayLeft: person.weekdayDuties || 0,
                weekendLeft: person.weekendDuties || 0,
                minDaysBetween: person.minDaysBetween,
                dutyDays: [],
                originalIndex: persons.findIndex(p => p.name === person.name),
                group: person.group || 0
            }));

            showLoading();

            const preAssignedDays = {};
            Object.keys(selectedCells).forEach(key => {
                if (selectedCells[key]) {
                    const [pIndex, dIndex] = key.split('-').map(Number);
                    const person = personnelDuties.find(p => p.originalIndex === pIndex);
                    if (person && dIndex >= 0 && dIndex < dates.length) {
                        preAssignedDays[key] = true;
                        if (dates[dIndex].isWeekend) {
                            person.weekendLeft = Math.max(0, person.weekendLeft - 1);
                        } else {
                            person.weekdayLeft = Math.max(0, person.weekdayLeft - 1);
                        }
                        person.dutyDays.push(dIndex);
                    }
                }
            });

            const balanceFridays = document.getElementById('balanceFridays').checked;
            const balanceThursdays = document.getElementById('balanceThursdays').checked;

            const groupingEnabled = document.getElementById('groupingCheckbox').checked;
                        
            if (groupingEnabled) {
                const groupSizes = {};
                persons.forEach(person => {
                    if (person.group > 0) {
                        groupSizes[person.group] = (groupSizes[person.group] || 0) + 1;
                    }
                });
            
                for (const group in groupSizes) {
                    if (groupSizes[group] > dutyPerDay) {
                        validationErrors.push({
                            type: 'error',
                            message: `${group}. grupta ${groupSizes[group]} kişi var, ancak nöbetçi sayısını ${dutyPerDay} seçtiniz!`
                        });
                    }
                }
            
                const hasAnyGroup = persons.some(person => person.group > 0);
                if (!hasAnyGroup) {
                    validationErrors.push({
                        type: 'error',
                        message: '"Birlikte nöbet tutması gerekenler var mı?" seçili, ancak hiç grup atanmamış!'
                    });
                }
            }
            
            const dailyCapacitiesArray = [];
            for (let d = 0; d < days; d++) {
                dailyCapacitiesArray.push(
                    (customCapEnabled && customDailyCapacities[d] !== undefined)
                        ? customDailyCapacities[d]
                        : dutyPerDay
                );
            }

            personnelDuties.forEach(person => {
                const minDays = person.minDaysBetween || 0;
                const totalDuties = (person.weekdayLeft || 0) + (person.weekendLeft || 0);
                if (minDays > 0 && totalDuties > 0) {
                    const maxPossible = Math.floor((days + minDays) / (minDays + 1));
                    if (totalDuties > maxPossible) {
                        validationErrors.push({
                            type: 'error',
                            message: `${person.name}: ${minDays} gün boşluk kuralıyla ${days} günde en fazla ${maxPossible} nöbet mümkün, ancak ${totalDuties} nöbet yazılmış. Boşluk süresini azaltın veya nöbet sayısını düşürün.`
                        });
                    }
                }
            });

            const blockedDaysList = [];
            for (let d = 0; d < days; d++) {
                const cap = dailyCapacitiesArray[d];
                const availableCount = persons.filter((_, pIdx) => !unavailableCells[`${pIdx}-${d}`]).length;
                if (availableCount < cap) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    blockedDaysList.push(`${date.toLocaleDateString('tr-TR')} (müsait: ${availableCount}, gereken: ${cap})`);
                }
            }
            if (blockedDaysList.length > 0) {
                const sample = blockedDaysList.slice(0, 3);
                const more = blockedDaysList.length > 3 ? ` ve ${blockedDaysList.length - 3} gün daha` : '';
                validationErrors.push({
                    type: 'error',
                    message: `Şu günlerde yeterli müsait personel yok: ${sample.join(', ')}${more}. İstenmeyen günleri azaltın veya personel ekleyin.`
                });
            }

            if (validationErrors.length > 0) {
                hideLoading();
                showErrorModal();
                return;
            }

            const data = {
               personnel: personnelDuties,
               totalDays: days,
               weekendDays: dates.map(d => d.isWeekend ? d.index : null).filter(d => d !== null),
               fridayDays: dates.map(d => d.isFriday ? d.index : null).filter(d => d !== null),
               thursdayDays: dates.map(d => d.isThursday ? d.index : null).filter(d => d !== null),
               unavailableCells: unavailableCells || {},
               preAssignedDays: preAssignedDays,
               maxConsecutiveDuties: 1,
               dutyPerDay: dutyPerDay,
               dailyCapacities: dailyCapacitiesArray,
               balanceFridays: balanceFridays,
               balanceThursdays: balanceThursdays
            };

            saveToHistory();

            const CLOUD_FUNCTIONS_URL = 'https://proxy-solver-88931343134.us-central1.run.app';

            fetch(CLOUD_FUNCTIONS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                return response.json().then(jsonData => ({ status: response.status, data: jsonData }));
            })
            .then(({ status, data }) => {
                hideLoading();
                
                if (status === 200 && Array.isArray(data.assignments)) {
                    data.assignments.forEach(a => {
                        const cellKey = `${a.pIndex}-${a.dayIndex}`;
                        selectedCells[cellKey] = true;
                    });
                    updateCalendar();
                    updateStatistics();
                    saveToHistory();
                    showToast('Tüm nöbetler başarıyla atandı! 💾 Çıkmadan önce listenizi "Kaydet" butonuyla hesabınıza saklamayı UNUTMAYIN.', 8000);
                } else {
                    let errorMessage = data.error || 'Bilinmeyen bir hata oluştu';
                    
                    // --- AI MESAJI KONTROLÜ ---
                    if (errorMessage.includes('⚠️')) {
                        const rawMessage = errorMessage.replace('⚠️ ÇÖZÜLEMEDİ:', '').trim();
                        
                        const formattedMessage = rawMessage.replace(/\n/g, '<br>').replace(/\*/g, '•');

                        document.getElementById('aiReportContent').innerHTML = formattedMessage;

                        const modalElem = document.getElementById('aiModal');
                        const instance = M.Modal.getInstance(modalElem); // Materialize instance'ı al
                        
                        if (!instance) {
                            M.Modal.init(modalElem).open();
                        } else {
                            instance.open();
                        }

                    } else {
                        if (status === 400 && errorMessage.includes('Nöbet atamaları yapılamadı')) {
                            errorMessage = 'Hata: Nöbet ertesi boşluk sayısını azaltmayı deneyin!';
                        } else if (status === 400 && errorMessage.includes('Cuma veya Perşembe dengeleme başarısız')) {
                            errorMessage = 'Hata: Cuma veya Perşembe dengeleme başarısız, bu seçenekleri kapatın veya nöbet ertesi boşlukları azaltıp tekrar deneyin!';
                        }
                        
                        showToast(errorMessage, 10000); // Standart toast
                    }
                }
            })
            .catch(error => {
                hideLoading();
                showToast('Sunucuyla bağlantı kurulamadı: ' + error.message, 10000);
            });
        }

        function updateCalendar() {
            const cells = document.querySelectorAll('.calendar-cell');
            cells.forEach(cell => {
                const pIndex = cell.dataset.pindex;
                const dIndex = cell.dataset.dindex;
                const cellKey = `${pIndex}-${dIndex}`;
                cell.classList.toggle('selected', !!selectedCells[cellKey]);
                cell.classList.toggle('unavailable', !!unavailableCells[cellKey]);
            });
            updateUndoRedoButtons();
        }

        function triggerFileUpload() {
            const csvUploadInput = document.getElementById('csvUpload');
            if (csvUploadInput) {
                csvUploadInput.click();
            } else {
                console.error('csvUpload input elementi bulunamadı!');
                M.toast({ html: 'Dosya yükleme alanı bulunamadı!', classes: 'teal' });
            }
        }

        function uploadPersonnel(event) {
            if (isUploading) return;

            const file = event.target.files[0];
            if (!file) {
                M.toast({ html: 'Lütfen bir dosya seçin!', classes: 'teal' });
                return;
            }
            if (!file.name.endsWith('.csv')) {
                M.toast({ html: 'Lütfen geçerli bir CSV dosyası yükleyin!', classes: 'teal' });
                return;
            }

            isUploading = true;
            showLoading();

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
                const headers = rows[0];

                if (headers[0] !== 'İsim') {
                    M.toast({ html: 'Geçersiz CSV formatı! Başlık "İsim" olmalı.', classes: 'teal' });
                    hideLoading();
                    isUploading = false;
                    return;
                }

                const newPersons = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (row[0]) {
                        const name = normalizeName(row[0].replace(/"/g, ''));
                        newPersons.push({
                            name: name,
                            weekdayDuties: row[1] ? parseInt(row[1]) : undefined,
                            weekendDuties: row[2] ? parseInt(row[2]) : undefined,
                            minDaysBetween: row[3] ? parseInt(row[3]) : 1
                        });
                    }
                }

                persons = newPersons.filter(p => p.name && !persons.some(existing => existing.name === p.name));
                renderTable();
                savePersonsToLocalStorage(); // KAYDET
                M.toast({ html: 'Personel listesi başarıyla yüklendi!', classes: 'teal' });
                hideLoading();
                isUploading = false;
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        function arrayBufferToBase64(buffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        }

        function downloadPersonnel() {
            const csvRows = [];
            const headers = ['İsim', 'Hafta İçi', 'Hafta Sonu', 'Nöbet Ertesi Boşluk'];
            csvRows.push(headers.join(','));

            persons.forEach(person => {
                const row = [
                    `"${person.name}"`,
                    person.weekdayDuties !== undefined ? person.weekdayDuties : '',
                    person.weekendDuties !== undefined ? person.weekendDuties : '',
                    person.minDaysBetween
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `personel_listesi_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            M.toast({ html: 'Personel listesi CSV olarak indirildi! Sonraki kullanımda buradan yüklemeniz yeterli!', classes: 'teal' });
        }

        function clearCalendar() {
            saveToHistory();
            selectedCells = {};
            unavailableCells = {};
            updateCalendar();
            updateStatistics();
            M.toast({ html: 'Takvimdeki tüm işaretlemeler temizlendi!' });
        }

        function loadHistoryForEditing() {
            const data = window.currentViewingHistory;
            if(!data) return;

            const modalElem = document.getElementById('historyModal');
            const instance = M.Modal.getInstance(modalElem);
            if(instance) instance.close();

            document.getElementById('startDate').value = data.startDate;
            document.getElementById('endDate').value = data.endDate;
            document.getElementById('holidays').value = data.holidays || '';
            M.updateTextFields();

            persons = JSON.parse(data.personnelSnapshot || '[]');
            selectedCells = JSON.parse(data.assignments || '{}');
            unavailableCells = JSON.parse(data.unavailable || '{}');
            
            let maxDuty = 1;
            const start = parseDate(data.startDate);
            const end = parseDate(data.endDate);
            const daysCount = daysBetween(data.startDate, data.endDate);
            
            for (let d = 0; d < daysCount; d++) {
                let count = 0;
                for(let p = 0; p < persons.length; p++){
                     if(selectedCells[`${p}-${d}`]) count++;
                }
                if(count > maxDuty) maxDuty = count;
            }
            document.getElementById('dutyPerDay').value = maxDuty;

            renderTable();
            rebuildCalendarForEdit(data.startDate, data.endDate, data.holidays, daysCount, start);

            setTimeout(() => {
                document.getElementById('calendarContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
            M.toast({html: 'Liste düzenleme modunda açıldı! Değişiklikleri yapıp Kaydet butonuna basarak üzerine yazabilirsiniz.', classes: 'orange darken-3 rounded', displayLength: 6000});
        }

        // GEÇMİŞ VERİSİ İLE TAKVİMİ SIFIRLAMADAN YENİDEN OLUŞTURMA FONKSİYONU
        function rebuildCalendarForEdit(startInput, endInput, holidayInput, days, start) {
            const holidays = getHolidays(holidayInput);

            const dates = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                const isWeekend = isWeekendDay(date, holidays);
                dates.push({ date: date.toISOString(), isWeekend });
            }

            let html = buildCalendarHTML(dates, persons, start, days);

            document.getElementById('calendarTable').innerHTML = html;

            const cells = document.querySelectorAll('.calendar-cell');
            const isMobile = isMobileDevice();
        
            cells.forEach(cell => {
                if (!isMobile) {
                    cell.addEventListener('mousedown', startDragging);
                    cell.addEventListener('mousemove', dragOver);
                    cell.addEventListener('mouseup', stopDragging);
                    cell.addEventListener('touchstart', startDragging, { passive: false });
                    cell.addEventListener('touchmove', dragOver, { passive: false });
                    cell.addEventListener('touchend', stopDragging);
                }
                
                cell.addEventListener('click', () => {
                    const pIndex = parseInt(cell.dataset.pindex);
                    const dIndex = parseInt(cell.dataset.dindex);
                    handleCellClick(pIndex, dIndex);
                });
                
                if (isMobile) {
                    cell.addEventListener('touchend', (event) => {
                        event.preventDefault();
                        const pIndex = parseInt(cell.dataset.pindex);
                        const dIndex = parseInt(cell.dataset.dindex);
                        handleCellClick(pIndex, dIndex);
                    }, { passive: false });
                }
            });

            if (collapsiblePersonel) collapsiblePersonel.open(0);
            if (collapsibleCalendar) collapsibleCalendar.open(0);
            updateStatistics();
            history = [];
            historyIndex = -1;
            saveToHistory(); 
        }
        
        function sendFeedback() {
            const email = document.getElementById('feedbackEmail').value.trim();
            const name = document.getElementById('feedbackName').value.trim();
            const message = document.getElementById('feedbackMessage').value.trim();
        
            if (!name || !message) {
                M.toast({ html: 'Lütfen adınızı ve mesajınızı doldurun!' });
                return;
            }
        
            if (!email) {
                const modalElem = document.getElementById('emailConfirmModal');
                M.Modal.getInstance(modalElem).open();
            } else {
                executeFeedbackSend(false);
            }
        }
        
        function executeFeedbackSend(isAnonymous = false) {
            const nameInput = document.getElementById('feedbackName');
            const emailInput = document.getElementById('feedbackEmail');
            const messageInput = document.getElementById('feedbackMessage');
            const submitButton = document.getElementById('feedback_submit');
            const feedbackLoading = document.getElementById('feedbackLoading');
        
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const message = messageInput.value.trim();
        
            submitButton.classList.add('disabled');
            feedbackLoading.style.display = 'block';
        
            emailjs.send('nobet_plani', 'template_3nxu9rm', {
                from_name: name,
                from_email: isAnonymous ? 'Anonim (E-posta Yok)' : email,
                message: message,
                reply_to: email || 'nobetplani@gmail.com'
            })
            .then(() => {
                M.toast({ html: 'Geri bildiriminiz başarıyla gönderildi!' });
                document.getElementById('feedbackForm').reset();
                M.Modal.getInstance(document.getElementById('feedbackModal')).close();
            })
            .catch((error) => {
                console.error('EmailJS Hatası:', error);
                M.toast({ html: 'Hata oluştu: ' + error.text });
            })
            .finally(() => {
                submitButton.classList.remove('disabled');
                feedbackLoading.style.display = 'none';
            });
        }
        
        function focusEmailField() {
            setTimeout(() => {
                document.getElementById('feedbackEmail').focus();
            }, 200);
        }
    
// ==========================================
// ==========================================

   function googleLogin() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(async (result) => { 
                const user = result.user;
                M.toast({html: 'Hoş geldin ' + user.displayName});
                updateLoginButton(user);

                if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                    try {
                        
                        const idToken = await user.getIdToken();
                        
                        
                        fetch("https://api.nobetplani.com", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                email: user.email,
                                name: user.displayName,
                                token: idToken,
                                role: "creator"
                            }),
                        })
                        .then(res => console.log("İlk kayıt"))
                        .catch(err => console.error("Mail gönderme hatası:", err));

                    } catch (tokenError) {
                        console.error("Token alınamadı:", tokenError);
                    }
                }
               

            }).catch((error) => {
                console.error(error);
                M.toast({html: 'Giriş hatası: ' + error.message});
            });
    }

    function googleLogout() {
        auth.signOut().then(() => {
            M.toast({html: 'Çıkış yapıldı'});
            window.location.reload();
        });
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            updateLoginButton(user);
            loadFromFirestore(user); 

            const pendingSave = sessionStorage.getItem('pendingSaveRequest');
            if (pendingSave === 'true') {
                sessionStorage.removeItem('pendingSaveRequest');
                M.toast({html: 'Giriş başarılı! Listeniz otomatik olarak kaydediliyor...', classes: 'blue darken-1'});
                setTimeout(() => { saveScheduleToHistory(); }, 1500);
            }

            const fbName = document.getElementById('feedbackName');
            const fbEmail = document.getElementById('feedbackEmail');
            if(fbName && fbEmail) {
                fbName.value = user.displayName || '';
                fbEmail.value = user.email || '';
                M.updateTextFields(); 
            }

        } else {
            const fbName = document.getElementById('feedbackName');
            const fbEmail = document.getElementById('feedbackEmail');
            if(fbName && fbEmail) {
                fbName.value = '';
                fbEmail.value = '';
                M.updateTextFields();
            }
        }
    });

    function updateLoginButton(user) {
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Kullanıcı';

        const userHtmlDesktop = `
            <a href="#" onclick="googleLogout()" class="btn waves-effect waves-light white black-text tooltipped" data-position="bottom" data-tooltip="Çıkış Yap">
                <img src="${user.photoURL}" style="vertical-align: middle; width: 24px; border-radius: 50%; margin-right: 5px;">
                ${firstName}
            </a>
        `;

        const userHtmlMobile = `
            <a href="#" onclick="googleLogout()" style="display: flex; align-items: center; padding-left: 32px;">
                <img src="${user.photoURL}" style="vertical-align: middle; width: 24px; border-radius: 50%; margin-right: 15px;">
                ${firstName} (Çıkış)
            </a>
        `;

        const loginLiDesktop = document.getElementById('login-li-desktop');
        if(loginLiDesktop) {
            loginLiDesktop.innerHTML = userHtmlDesktop;
        }

        const loginLiMobile = document.getElementById('login-li-mobile');
        if(loginLiMobile) {
            loginLiMobile.innerHTML = userHtmlMobile;
        }
        
        M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    }


    function saveToFirestore() {
        const user = auth.currentUser;
        if (user) {
            db.collection("users").doc(user.uid).set({
                personnelList: JSON.stringify(persons), 
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then(() => {
            })
            .catch((error) => {
                console.error("Yedekleme hatası: ", error);
            });
        }
    }

    function loadFromFirestore(user) {
        
        if (persons.length > 0) {
            
            M.toast({
                html: '<span>Mevcut listeniz korundu. (Buluttaki eski liste çekilmedi)</span><button class="btn-flat toast-action" onclick="forceLoadCloud()">Yine de Çek</button>', 
                classes: 'blue darken-3',
                displayLength: 6000
            });
            
            saveToFirestore(); 
            
            return; 
        }

        db.collection("users").doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().personnelList) {
                const cloudData = JSON.parse(doc.data().personnelList);
                
                if(cloudData.length > 0) {
                    persons = cloudData.map(p => ({ ...p, name: normalizeName(p.name) }));
                    renderTable();
                    savePersonsToLocalStorage();
                    M.toast({html: 'Personel listeniz buluttan yüklendi!', classes: 'green'});
                }
            } else {
                if (persons.length > 0) {
                    saveToFirestore();
                }
            }
        }).catch((error) => {
        });
    }

    function forceLoadCloud() {
        const user = auth.currentUser;
        if(user) {

            persons = []; 
            loadFromFirestore(user);
        }
    }

    // --- GÜNCELLENMİŞ KAYDETME FONKSİYONU (KONTROLLÜ VE OTOMATİK UYUMLU) ---
    function saveScheduleToHistory() {
        // 1. KONTROL: Kullanıcı Giriş Yapmış mı?
        const user = auth.currentUser;
        if (!user) {
            sessionStorage.setItem('pendingSaveRequest', 'true'); 
            
            M.toast({html: 'Kaydetmek için önce giriş yapmalısınız. Giriş ekranı açılıyor...', classes: 'orange darken-2'});
            googleLogin();
            return;
        }

        const { startInput, endInput } = getFormInputs();
        
        if (!startInput || Object.keys(selectedCells).length === 0) {
            M.toast({html: 'Kaydedilecek bir nöbet tablosu yok! Önce takvimi oluşturun ve işaretleme yapın.', classes: 'red'});
            return;
        }

        checkIncompleteDays(function() {
            _doSaveScheduleToHistory(startInput);
        });
    }

    function _doSaveScheduleToHistory(startInput) {
        const user = auth.currentUser;
        if (!user) return;
        const endInput = document.getElementById('endDate').value;

        // 2. KONTROL: ID Oluşturma (YIL-AY Formatı)
        const [day, month, year] = startInput.split('-'); 
        const docId = `${year}-${month}`;
        
        // --- KRİTİK DÜZELTME BURADA ---
        let btn = null;
        let originalText = 'Kaydet'; // Varsayılan metin

        if (typeof event !== 'undefined' && event && event.target) {
            btn = event.target.closest('button');
            if (btn) {
                originalText = btn.innerHTML;
                btn.innerHTML = '<i class="material-icons left">hourglass_empty</i>Kontrol...';
                btn.classList.add('disabled');
            }
        }

        const docRef = db.collection("users").doc(user.uid).collection("history").doc(docId);

        // 3. KONTROL: Veri Var mı? (Çakışma Kontrolü)
        docRef.get().then((doc) => {
            if (doc.exists) {
                // Kayıt varsa butonu eski haline getir
                if(btn) resetButton(btn, originalText);
                
                openOverwriteModal(docRef, startInput, endInput, btn, originalText, month, year);
            } else {
                performSave(docRef, startInput, endInput, btn, originalText);
            }
        }).catch((error) => {
            console.error("Kontrol hatası:", error);
            M.toast({html: 'Veritabanı kontrol edilemedi: ' + error.message, classes: 'red'});
            if(btn) resetButton(btn, originalText);
        });
    }

    function openOverwriteModal(docRef, startInput, endInput, btn, originalText, month, year) {
        const modalElem = document.getElementById('overwriteModal');
        const instance = M.Modal.getInstance(modalElem); 
        
        const monthName = getMonthName(parseInt(month)); 
        
        document.getElementById('overwriteMessage').innerHTML = 
            `<b>${monthName} ${year}</b> dönemi için daha önce kaydedilmiş bir listeniz zaten var.<br><br>` +
            `Eski listeyi silip, şu an ekrandaki listeyi onun yerine kaydetmek istiyor musunuz?`;
        
        const confirmBtn = document.getElementById('confirmOverwriteBtn');
        confirmBtn.onclick = function() {
            instance.close(); // Modalı kapat
            performSave(docRef, startInput, endInput, btn, originalText); // Kaydetmeyi başlat
        };
        
        instance.open(); // Pencereyi göster
    }

    function performSave(docRef, startInput, endInput, btn, originalText) {
        if (btn) {
            btn.innerHTML = '<i class="material-icons left">cloud_upload</i>Yazılıyor...';
        }

        const scheduleData = {
            docId: docRef.id,
            startDate: startInput,
            endDate: endInput,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            assignments: JSON.stringify(selectedCells),
            unavailable: JSON.stringify(unavailableCells),
            personnelSnapshot: JSON.stringify(persons), 
            holidays: document.getElementById('holidays').value || "" 
        };

        docRef.set(scheduleData)
            .then(() => {
                M.toast({html: '✅ Nöbet listesi başarıyla kaydedildi!', classes: 'orange darken-3'});
                
                if (btn) {
                    btn.innerHTML = '<i class="material-icons left">check</i>Tamam';
                    setTimeout(() => resetButton(btn, originalText), 2000);
                }
            })
            .catch((error) => {
                console.error("Kaydetme hatası: ", error);
                M.toast({html: 'Hata: ' + error.message, classes: 'orange darken-3'});
                
                if (btn) {
                    resetButton(btn, originalText);
                }
            });
    }

    function resetButton(btn, originalText) {
        if (btn) {
            btn.innerHTML = originalText;
            btn.classList.remove('disabled');
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        const historyModalElem = document.getElementById('historyModal');
        M.Modal.init(historyModalElem, {
            onOpenStart: loadHistoryList // Modal açılırken bu fonksiyonu çalıştır
        });
    });

    window.allHistoryDocs = []; 
    window.selectedYears = [];

    function loadHistoryList() {
    // 1. KONTROL: auth değişkeninin ve Firebase'in hazır olduğundan emin ol
    const currentAuth = (typeof auth !== 'undefined') ? auth : firebase.auth();
    const user = currentAuth.currentUser;

    const listContainer = document.getElementById('historyList');
    const loader = document.getElementById('historyLoading');
    const detailPanel = document.getElementById('historyDetail');
    const placeholder = document.getElementById('historyPlaceholder');

    if (!user) {
        
        listContainer.innerHTML = '<div class="center-align" style="padding:20px;"><div class="preloader-wrapper small active"><div class="spinner-layer spinner-teal-only"><div class="circle-clipper left"><div class="circle"></div></div><div class="gap-patch"><div class="circle"></div></div><div class="circle-clipper right"><div class="circle"></div></div></div></div><p class="grey-text" style="font-size:0.8rem;">Oturum kontrol ediliyor...</p></div>';
        
        setTimeout(() => {
            if (currentAuth.currentUser) {
                loadHistoryList(); // Oturum geldiyse fonksiyonu baştan çalıştır
            } else {
                listContainer.innerHTML = '<a class="collection-item red-text center-align" style="font-weight:bold;"><i class="material-icons left">error_outline</i>Görüntülemek için giriş yapmalısınız.</a>';
            }
        }, 1000);
        return;
    }

    listContainer.innerHTML = '';
    detailPanel.style.display = 'none';
    placeholder.style.display = 'none'; 
    loader.style.display = 'block';

    db.collection("users").doc(user.uid).collection("history").orderBy("updatedAt", "desc").get()
        .then((querySnapshot) => {
            loader.style.display = 'none';
            
            if (querySnapshot.empty) {
                listContainer.innerHTML = '<a class="collection-item">Henüz kaydedilmiş bir geçmiş bulunamadı.</a>';
                placeholder.style.display = 'block';
                return;
            }

            window.allHistoryDocs = [];
            const yearsMap = {}; 

            querySnapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id; 
                window.allHistoryDocs.push(data);

                const [year, month] = data.id.split('-');
                if (!yearsMap[year]) yearsMap[year] = [];
                yearsMap[year].push(data);
            });

            const cumItem = document.createElement('a');
            cumItem.className = 'collection-item waves-effect';
            cumItem.style.fontWeight = 'bold';
            cumItem.style.color = '#d32f2f';
            cumItem.style.backgroundColor = '#fff3e0';
            cumItem.style.borderBottom = '2px solid #e0e0e0';
            cumItem.innerHTML = `<i class="material-icons left" style="margin-right: 10px;">stacked_line_chart</i>Kümülatif İstatistikler`;
            cumItem.onclick = () => showCumulativeView();
            listContainer.appendChild(cumItem);

            const sortedYears = Object.keys(yearsMap).sort((a, b) => b - a);
            const currentYear = new Date().getFullYear().toString();

            sortedYears.forEach(year => {
                const yearHeader = document.createElement('div');
                yearHeader.className = 'collection-item waves-effect grey lighten-4 black-text';
                yearHeader.style.cursor = 'pointer';
                yearHeader.style.fontWeight = '700';
                yearHeader.style.display = 'flex';
                yearHeader.style.justifyContent = 'space-between';
                yearHeader.style.alignItems = 'center';
                yearHeader.style.borderTop = '1px solid #e0e0e0';
                yearHeader.innerHTML = `
                    <span><i class="material-icons left" style="font-size: 1.2rem; margin-top:2px;">calendar_today</i>${year} Kayıtları</span>
                    <i class="material-icons grey-text" id="icon_${year}">expand_more</i>
                `;
                
                const monthsContainer = document.createElement('div');
                monthsContainer.id = `container_${year}`;
                monthsContainer.style.transition = 'all 0.3s ease';
                
                const isCurrentOrNewest = (year === currentYear) || (year === sortedYears[0]);
                
                if (isCurrentOrNewest) {
                    monthsContainer.style.display = 'block';
                    yearHeader.querySelector('i:last-child').innerText = 'expand_less';
                    yearHeader.classList.add('teal', 'lighten-5');
                } else {
                    monthsContainer.style.display = 'none';
                }

                yearHeader.onclick = () => {
                    const isHidden = monthsContainer.style.display === 'none';
                    if (isHidden) {
                        monthsContainer.style.display = 'block';
                        document.getElementById(`icon_${year}`).innerText = 'expand_less';
                        yearHeader.classList.add('teal', 'lighten-5');
                    } else {
                        monthsContainer.style.display = 'none';
                        document.getElementById(`icon_${year}`).innerText = 'expand_more';
                        yearHeader.classList.remove('teal', 'lighten-5');
                    }
                };

                listContainer.appendChild(yearHeader);

                yearsMap[year].sort((a, b) => {
                    const monthA = parseInt(a.id.split('-')[1]);
                    const monthB = parseInt(b.id.split('-')[1]);
                    return monthB - monthA;
                });

                yearsMap[year].forEach(data => {
                    const [y, m] = data.id.split('-');
                    const monthName = getMonthName(parseInt(m));
                    
                    const li = document.createElement('a');
                    li.className = 'collection-item waves-effect black-text';
                    li.style.paddingLeft = '45px'; 
                    li.style.borderLeft = '4px solid transparent'; 
                    li.style.color = '#374151';
                    li.innerHTML = `
                        <span class="title" style="font-weight: 500; font-size: 1rem;">${monthName}</span>
                        <br><span class="grey-text" style="font-size: 0.75rem;">
                            <i class="material-icons tiny" style="vertical-align: middle;">update</i> 
                            ${data.updatedAt ? new Date(data.updatedAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}
                        </span>
                    `;
                    
                    li.onclick = function() {
                        showHistoryDetail(data);
                        const allItems = listContainer.querySelectorAll('a.collection-item');
                        allItems.forEach(item => item.style.borderLeft = '4px solid transparent');
                        this.style.borderLeft = '4px solid #009688';
                    };
                    
                    monthsContainer.appendChild(li);
                });

                listContainer.appendChild(monthsContainer);
            });
            
            placeholder.style.display = 'block';
        })
        .catch((error) => {
            console.error("Geçmiş yükleme hatası:", error);
            loader.style.display = 'none';
            listContainer.innerHTML = '<a class="collection-item red-text">Hata oluştu.</a>';
        });
}
    function showHistoryDetail(data) {
        highlightActiveItem(event.currentTarget);
        
        window.currentViewingHistory = data; // EKLENDİ: Düzenleme için veriyi hafızaya al

        document.getElementById('historyPlaceholder').style.display = 'none';
        document.getElementById('historyDetail').style.display = 'block';
        document.getElementById('yearFilterContainer').style.display = 'none'; // Yıl filtresini gizle

        const [year, month] = data.id.split('-');
        const title = `${getMonthName(parseInt(month))} ${year}`;
        
        document.getElementById('historyDetailTitle').innerText = title;
        
    document.getElementById('historyActions').innerHTML = `
        <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
            
            <a class="dropdown-trigger btn waves-effect waves-light blue darken-1" href="#" data-target="historyShareDropdown" style="height: 36px; line-height: 36px;">
                <i class="material-icons left">share</i>Paylaş
            </a>

            <ul id="historyShareDropdown" class="dropdown-content" style="min-width: 210px; border-radius: 8px;">
                <li><a href="#!" onclick="shareHistoryAsLink()"><i class="material-icons">link</i>WhatsApp Linki Oluştur</a></li>
                <li class="divider"></li>
                <li><a href="#!" onclick="downloadHistoryAsImage('${data.id}')"><i class="material-icons">image</i>Liste Fotoğrafını İndir</a></li>
            </ul>

            <button class="btn waves-effect waves-light orange darken-3" onclick="loadHistoryForEditing()">
                <i class="material-icons left">edit</i>Düzenle
            </button>
            
            <button class="btn waves-effect waves-light teal" onclick="downloadHistoryTable('${data.id}')">
                <i class="material-icons left">file_download</i>Excel
            </button>
        </div>
    `;

    const shareBtn = document.querySelector('.dropdown-trigger[data-target="historyShareDropdown"]');
    if(shareBtn) M.Dropdown.init(shareBtn, { coverTrigger: false, constrainWidth: false });

        const contentDiv = document.getElementById('historyStatsContent');
        const stats = calculateStatsForDoc(data); 
        
        contentDiv.innerHTML = generateStatsTableHTML(stats) + generateMiniCalendarHTML(data);
    }

    function showCumulativeView() {
        if(event && event.currentTarget) highlightActiveItem(event.currentTarget);

        document.getElementById('historyPlaceholder').style.display = 'none';
        document.getElementById('historyDetail').style.display = 'block';
        document.getElementById('yearFilterContainer').style.display = 'block'; // Yıl filtresini göster

        document.getElementById('historyDetailTitle').innerText = "Kümülatif Toplamlar";
        document.getElementById('historyActions').innerHTML = ""; 

        const years = new Set();
        window.allHistoryDocs.forEach(d => {
            const y = d.id.split('-')[0];
            years.add(y);
        });
        const sortedYears = Array.from(years).sort();

        const btnContainer = document.getElementById('yearButtons');
        btnContainer.innerHTML = "";
        
        const currentYear = new Date().getFullYear().toString();
        window.selectedYears = sortedYears.includes(currentYear) ? [currentYear] : (sortedYears.length > 0 ? [sortedYears[sortedYears.length-1]] : []);

        sortedYears.forEach(y => {
            const btn = document.createElement('div');
            btn.className = 'chip';
            btn.style.cursor = 'pointer';
            btn.style.margin = '0 5px';
            btn.innerText = y;
            
            if (window.selectedYears.includes(y)) {
                btn.classList.add('teal', 'white-text');
            }

            btn.onclick = () => toggleYearFilter(y, btn);
            btnContainer.appendChild(btn);
        });

        recalcCumulative();
    }

    function toggleYearFilter(year, btnElem) {
        if (window.selectedYears.includes(year)) {
            window.selectedYears = window.selectedYears.filter(y => y !== year);
            btnElem.classList.remove('teal', 'white-text');
        } else {
            window.selectedYears.push(year);
            btnElem.classList.add('teal', 'white-text');
        }
        recalcCumulative();
    }

    function recalcCumulative() {
        const contentDiv = document.getElementById('historyStatsContent');
        if (window.selectedYears.length === 0) {
            contentDiv.innerHTML = '<div class="card-panel yellow lighten-4 black-text"><i class="material-icons left">warning</i>Lütfen yukarıdan en az bir yıl seçiniz.</div>';
            return;
        }

        const grandTotals = {};

        window.allHistoryDocs.forEach(doc => {
            const docYear = doc.id.split('-')[0];
            if (window.selectedYears.includes(docYear)) {
                const docStats = calculateStatsForDoc(doc);
                
                docStats.forEach(personStat => {
                    const name = personStat.name; 
                    if (!grandTotals[name]) {
                        grandTotals[name] = { 
                            name: name, weekday: 0, weekend: 0, 
                            officialHoliday: 0, thursday: 0, friday: 0, totalHours: 0
                        };
                    }
                    grandTotals[name].weekday += personStat.weekday;
                    grandTotals[name].weekend += personStat.weekend;
                    grandTotals[name].officialHoliday += personStat.officialHoliday;
                    grandTotals[name].thursday += personStat.thursday;
                    grandTotals[name].friday += personStat.friday;
                    grandTotals[name].totalHours += personStat.totalHours;
                });
            }
        });

        const statsArray = Object.values(grandTotals).sort((a,b) => a.name.localeCompare(b.name));
        contentDiv.innerHTML = generateStatsTableHTML(statsArray, true);
    }


    function calculateStatsForDoc(data) {
    const assignments = JSON.parse(data.assignments || '{}');
    const personnel = JSON.parse(data.personnelSnapshot || '[]');
    const savedHolidays = getHolidays(data.holidays || "");
    
    const startDate = parseDate(data.startDate);
    const endDateObj = parseDate(data.endDate);
    const daysDiff = daysBetween(data.startDate, data.endDate);

    const stats = personnel.map(p => ({
        name: p.name, weekday: 0, weekend: 0, thursday: 0, friday: 0, officialHoliday: 0, totalHours: 0
    }));

    for (let d = 0; d < daysDiff; d++) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + d);
        
        const dayNum = current.getDate();
        const dayOfWeek = current.getDay(); 
        const isOfficialHoliday = savedHolidays.includes(dayNum);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isFriday = dayOfWeek === 5;
        const isThursday = dayOfWeek === 4;

        personnel.forEach((p, pIndex) => {
            if (assignments[`${pIndex}-${d}`]) {
                if (isOfficialHoliday) {
                    stats[pIndex].officialHoliday++;
                    stats[pIndex].totalHours += 24;
                } else if (isWeekend) {
                    stats[pIndex].weekend++;
                    stats[pIndex].totalHours += 24;
                } else {
                    stats[pIndex].weekday++;
                    stats[pIndex].totalHours += 16;
                    if (isFriday) stats[pIndex].friday++;
                    if (isThursday) stats[pIndex].thursday++;
                }
            }
        });
    }
    return stats;
}

    function generateStatsTableHTML(stats, isCumulative = false) {
        let html = `
            <table class="striped responsive-table centered bordered" style="font-size:0.9rem;">
                <thead class="teal lighten-5">
                    <tr>
                        <th style="font-weight: 800; color: #004d40;">PERSONEL</th>
                        <th>Hafta İçi</th>
                        <th>Hafta Sonu</th>
                        <th style="color: #d32f2f;">Resmi Tatil</th>
                        <th>Perşembe</th>
                        <th>Cuma</th>
                        <th style="font-weight: 800; background: #e0f2f1;">GENEL TOPLAM</th>
                        <th style="color: #d32f2f; font-weight: bold;">Toplam Saat</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        stats.forEach(s => {
            const total = s.weekday + s.weekend + s.officialHoliday;
            html += `
                <tr>
                    <td style="font-weight:bold; text-align: left; padding-left: 15px;">${s.name}</td>
                    <td>${s.weekday}</td>
                    <td>${s.weekend}</td>
                    <td style="color: #d32f2f; font-weight: bold;">${s.officialHoliday}</td>
                    <td>${s.thursday}</td>
                    <td>${s.friday}</td>
                    <td style="font-weight: bold; background: #e0f2f1; font-size: 1rem;">${total}</td>
                    <td style="color: #d32f2f; font-weight: bold;">${s.totalHours}</td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        if(isCumulative) html += `<p class="grey-text right-align" style="margin-top:5px; font-size:0.8rem;">*Toplamlar, ismi tam eşleşen kayıtlar üzerinden hesaplanmıştır.</p>`;
        return html;
    }

    function generateMiniCalendarHTML(data) {
    const [year, month] = data.id.split('-');
    const assignments = JSON.parse(data.assignments || '{}');
    const personnel = JSON.parse(data.personnelSnapshot || '[]');
    const savedHolidays = getHolidays(data.holidays || "");
    
    const startDate = parseDate(data.startDate);
    const endDateObj = parseDate(data.endDate);
    const daysDiff = daysBetween(data.startDate, data.endDate);

    let contentHtml = `<h6 class="teal-text" style="margin-top: 30px;">Nöbet Çizelgesi</h6>
                    <div style="overflow-x:auto;">
                    <table id="historyCalendarTable_${data.id}" class="bordered centered" style="font-size:0.8rem; border:1px solid #eee;">
                    <thead><tr><th>Gün</th>`;
    
    for(let d=0; d<daysDiff; d++){
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + d);
        const dayNum = current.getDate();
        const isOfficial = savedHolidays.includes(dayNum);
        const isWknd = current.getDay() === 0 || current.getDay() === 6;
        let colorStyle = "";
        if(isOfficial) colorStyle = "background-color: #ffcdd2; color: #d32f2f;"; 
        else if(isWknd) colorStyle = "background-color: #cfd8dc;"; 
        contentHtml += `<th style="${colorStyle}; min-width:30px; padding: 5px;">${dayNum}</th>`;
    }
    contentHtml += `</tr></thead><tbody>`;

    personnel.forEach((p, pIndex) => {
        contentHtml += `<tr><td style="text-align:left; font-weight:bold; padding: 5px;">${p.name}</td>`;
        for(let d=0; d<daysDiff; d++){
            const isAssigned = assignments[`${pIndex}-${d}`];
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + d);
            const isOfficial = savedHolidays.includes(current.getDate());
            const isWknd = current.getDay() === 0 || current.getDay() === 6;
            let cellStyle = "border: 1px solid #eee;";
            if(isOfficial) cellStyle += "background-color: #ffebee;";
            else if(isWknd) cellStyle += "background-color: #eceff1;";
            let cellContent = isAssigned ? '<span style="color:green; font-weight:bold;">✓</span>' : '';
            contentHtml += `<td style="${cellStyle}">${cellContent}</td>`;
        }
        contentHtml += `</tr>`;
    });
    contentHtml += `</tbody></table></div>`;
    return contentHtml;
}

    function downloadHistoryTable(docId) {
        const data = window.allHistoryDocs.find(d => d.id === docId);
        if (!data) {
            M.toast({html: 'Veri bulunamadı!', classes: 'red'});
            return;
        }

        const assignments = JSON.parse(data.assignments || '{}');
        const personnel = JSON.parse(data.personnelSnapshot || '[]');
        const holidays = getHolidays(data.holidays || '');

        const start = parseDate(data.startDate);
        const end = parseDate(data.endDate);
        const days = daysBetween(data.startDate, data.endDate);
        const scheduleData = {};

        for (let d = 0; d < days; d++) {
            const currentDate = new Date(start);
            currentDate.setDate(currentDate.getDate() + d);
            const dateStr = currentDate.toLocaleDateString('tr-TR');
            scheduleData[dateStr] = [];

            personnel.forEach((p, pIndex) => {
                if (assignments[`${pIndex}-${d}`]) {
                    scheduleData[dateStr].push(p.name);
                }
            });
        }

        let columnCount = 1;
        for (const date in scheduleData) {
            columnCount = Math.max(columnCount, scheduleData[date].length);
        }

        const styledData = [];
        const headers = [{ v: 'Tarih', t: 's', s: { font: { bold: true, sz: 16 } } }];
        for (let i = 1; i <= columnCount; i++) {
            headers.push({ v: `Nöbetçi ${i}`, t: 's', s: { font: { bold: true, sz: 16 } } });
        }
        styledData.push(headers);

        for (let d = 0; d < days; d++) {
            const currentDate = new Date(start);
            currentDate.setDate(currentDate.getDate() + d);
            const dateStr = currentDate.toLocaleDateString('tr-TR');
            const isWeekend = isWeekendDay(currentDate, null);
            const isHoliday = holidays.includes(currentDate.getDate());

            let dateStyle = { font: { bold: true, sz: 16 } }; 
            if (isWeekend && !isHoliday) {
                dateStyle.fill = { fgColor: { rgb: "808080" } }; 
            }
            if (isHoliday) {
                dateStyle = {
                    fill: { fgColor: { rgb: "808080" } }, 
                    font: { bold: true, sz: 16, color: { rgb: "FF0000" } } 
                };
            }

            const row = [{ v: dateStr, t: 's', s: dateStyle }]; 
            const assigned = scheduleData[dateStr] || [];
            for (let i = 0; i < columnCount; i++) {
                row.push({ v: assigned[i] || '', t: 's', s: { font: { sz: 16 } } }); 
            }
            styledData.push(row);
        }

        const ws = XLSX.utils.aoa_to_sheet(styledData);
        ws['!cols'] = [
            { wch: 14 }, 
            ...Array(columnCount).fill({ wch: 22 }) 
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Geçmiş Nöbet Listesi");

        const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
        const fileName = `Gecmis_Nobet_Listesi_${docId}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        M.toast({html: 'Geçmiş liste indirildi!', classes: 'green'});
    }

    function getMonthName(monthIndex) {
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        return months[monthIndex - 1] || 'Bilinmiyor';
    }

    function highlightActiveItem(elem) {
        const items = document.querySelectorAll('#historyList .collection-item');
        items.forEach(i => {
            i.classList.remove('active');
            i.classList.remove('teal');
            if(i !== elem && i.innerText.includes('Kümülatif')) {
                i.style.backgroundColor = '#fff3e0'; 
                i.style.color = '#d32f2f';
            } else if (i !== elem) {
                i.style.backgroundColor = '';
                i.style.color = '#374151'; 
            }
        });
        elem.classList.add('active', 'teal');
        elem.style.backgroundColor = ''; 
        elem.style.color = 'white';
    }

   
function downloadAsImage() {
    const targetElement = document.getElementById('calendarTable');
    
    if (!targetElement || targetElement.innerHTML.trim() === '') {
        M.toast({html: 'İndirilecek bir takvim bulunamadı!', classes: 'teal rounded'});
        return;
    }

    M.toast({html: '📸 Fotoğraf hazırlanıyor, lütfen bekleyin...', classes: 'blue darken-1 rounded', displayLength: 2000});

    const originalMargin = targetElement.style.marginBottom;
    const originalBorder = targetElement.style.borderBottom;
    targetElement.style.marginBottom = "20px"; 
    targetElement.style.borderBottom = "1px solid #ccc";

    const unavailableCellsList = targetElement.querySelectorAll('.unavailable');
    unavailableCellsList.forEach(cell => {
        cell.classList.remove('unavailable');
        cell.classList.add('temp-unavailable');
    });

    html2canvas(targetElement, {
        scale: 2, 
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
    }).then(canvas => {
        // İşlem bitti, tablo boyutlarını eski haline getir
        targetElement.style.marginBottom = originalMargin;
        targetElement.style.borderBottom = originalBorder;

        const tempCells = targetElement.querySelectorAll('.temp-unavailable');
        tempCells.forEach(cell => {
            cell.classList.remove('temp-unavailable');
            cell.classList.add('unavailable');
        });

        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Nobet_Listesi_${new Date().toISOString().split('T')[0]}.png`;
        link.href = imgData;
        link.click();
        M.toast({html: '✅ Fotoğraf başarıyla cihazınıza indirildi!', classes: 'blue darken-1 rounded'});
    }).catch(err => {
        targetElement.style.marginBottom = originalMargin;
        targetElement.style.borderBottom = originalBorder;
        const tempCells = targetElement.querySelectorAll('.temp-unavailable');
        tempCells.forEach(cell => {
            cell.classList.remove('temp-unavailable');
            cell.classList.add('unavailable');
        });

        console.error("Resim hatası:", err);
        M.toast({html: 'Resim oluşturulurken bir hata oluştu.', classes: 'blue darken-1 rounded'});
    });
}

// YENİ: Modern Paylaşım Modalı ve Link Üretimi
function createMagicLink(btn) {
    const startInput = document.getElementById('startDate').value;
    if (!startInput || Object.keys(selectedCells).length === 0) {
        M.toast({html: 'Paylaşılacak bir liste yok! Önce takvimi oluşturun.', classes: 'blue darken-1 rounded'});
        return;
    }

    if (!auth.currentUser) {
        M.toast({html: 'Paylaşım linki oluşturmak için giriş yapmalısınız.', classes: 'blue darken-1'});
        googleLogin();
        return;
    }

    checkIncompleteDays(function() {
        _doCreateMagicLink(btn);
    });
}

function _doCreateMagicLink(btn) {
    const startInput = document.getElementById('startDate').value;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="material-icons left">loop</i>Bekleyin...';
    btn.classList.add('disabled');

    const [day, month, year] = startInput.split('-');
    const uid = auth.currentUser.uid;
    const listId = `liste_${uid}_${year}-${month}`;

    const scheduleData = {
        startDate: startInput,
        endDate: document.getElementById('endDate').value,
        assignments: JSON.stringify(selectedCells),
        unavailable: JSON.stringify(unavailableCells),
        personnelSnapshot: JSON.stringify(persons),
        holidays: document.getElementById('holidays').value || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = db.collection("public_lists").doc(listId);

    docRef.get().then((doc) => {
        if (doc.exists) {
            return docRef.update(scheduleData);
        } else {
            return docRef.set({ ...scheduleData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    })
        .then(() => {
            const magicLink = `https://nobetplani.com/?listeID=${listId}`;
            document.getElementById('generatedMagicLink').value = magicLink;
            window.lastGeneratedScheduleData = scheduleData;
            const modalElem = document.getElementById('shareLinkModal');
            M.Modal.getInstance(modalElem).open();
        })
        .catch((error) => {
            console.error("Paylaşım hatası: ", error);
            M.toast({html: 'Paylaşım linki oluşturulamadı: ' + error.message, classes: 'blue darken-1 rounded'});
        })
        .finally(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('disabled');
        });
}

// YENİ: Modal içindeki kopyalama fonksiyonu
function copyGeneratedLink() {
    const linkInput = document.getElementById('generatedMagicLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Mobil cihazlar için stabilite
    navigator.clipboard.writeText(linkInput.value).then(() => {
        M.toast({html: '✅ Link başarıyla kopyalandı! WhatsApp\'a yapıştırabilirsiniz.', classes: 'blue darken-1 rounded', displayLength: 4000});
    }).catch(err => {
        M.toast({html: 'Kopyalama başarısız, lütfen manuel kopyalayın.', classes: 'blue darken-1 rounded'});
    });
}

function openAdminCalendarModal() {
    const shareModalElem = document.getElementById('shareLinkModal');
    const shareModal = M.Modal.getInstance(shareModalElem);
    if(shareModal) shareModal.close();

    if (window.lastGeneratedScheduleData) {
        window.magicListData = window.lastGeneratedScheduleData;
        renderMagicList(window.magicListData); 
        
        const magicModalElem = document.getElementById('magicLinkModal');
        const magicModal = M.Modal.getInstance(magicModalElem);
        if(magicModal) magicModal.open();
    } else {
        M.toast({html: 'Veri bulunamadı, lütfen sayfayı yenileyin.', classes: 'red rounded'});
    }
}

// ==========================================
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const listeID = urlParams.get('listeID');

    if (listeID) {
        const magicModalElem = document.getElementById('magicLinkModal');
        const magicModal = M.Modal.init(magicModalElem, { dismissible: false });
        
        M.toast({html: 'Paylaşılan liste yükleniyor...', classes: 'blue rounded', displayLength: 2000});
        
        db.collection("public_lists").doc(listeID).get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                window.magicListData = data; // Takvime eklerken kullanacağız
                renderMagicList(data);       // Tabloyu çiz
                magicModal.open();           // Modalı ekranda göster
            } else {
                M.toast({html: 'Hata: Liste bulunamadı veya silinmiş!', classes: 'red rounded', displayLength: 4000});
            }
        }).catch((error) => {
            console.error("Liste çekme hatası:", error);
            M.toast({html: 'Veritabanına bağlanılamadı.', classes: 'red rounded'});
        });
    }
});

function getAbbreviatedName(fullName) {
    if (!fullName) return "";
    const names = fullName.replace(/\./g, ' ').split(/\s+/).filter(name => name.length > 0);
    if (names.length <= 1) return fullName;
    const lastName = names.pop();
    const abbreviatedFirstNames = names.map(name => name.charAt(0).toUpperCase() + ".");
    return abbreviatedFirstNames.join(" ") + " " + lastName;
}

function renderMagicList(data) {
    const assignments = JSON.parse(data.assignments || '{}');
    const personnel = JSON.parse(data.personnelSnapshot || '[]');
    const savedHolidays = getHolidays(data.holidays || "");
    
    const startDateObj = parseDate(data.startDate);
    const endDateObj = parseDate(data.endDate);
    const daysDiff = daysBetween(data.startDate, data.endDate);

    const selectBox = document.getElementById('magicPersonSelect');
    selectBox.innerHTML = '<option value="" disabled selected>Listeden isminizi bulun...</option>';
    personnel.forEach((p, index) => {
        selectBox.innerHTML += `<option value="${index}">${p.name}</option>`;
    });

    const monthName = startDateObj.toLocaleString('tr-TR', { month: 'long' });
    const yearNum = startDateObj.getFullYear();
    const firstDayOfMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 1);
    const lastDayOfMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0: Pazar, 1: Pzt, ...

    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    let calendarHtml = `<h6 class="teal-text center-align" style="font-weight:bold; margin-top:20px; font-size:1.3rem;">${monthName} ${yearNum} Nöbetleri</h6>
                    <div style="overflow-x:auto;">
                    <table class="centered magic-calendar-table" style="border:1px solid #eee; border-collapse: collapse; width: 100%;">
                    <thead><tr style="border-bottom: 2px solid #26a69a;">`;
    
    dayNames.forEach(day => {
        calendarHtml += `<th style="padding: 10px 5px; font-weight: bold; color: #26a69a; border: 1px solid #ddd; width: 14.28%;">${day}</th>`;
    });
    calendarHtml += `</tr></thead><tbody>`;

    let currentDay = 1;
    for (let i = 0; i < 6; i++) { // Max 6 hafta
        calendarHtml += `<tr>`;
        for (let j = 0; j < 7; j++) {
            let cellStyle = "border: 1px solid #ddd; width: 14.28%; height: 95px; vertical-align: top; padding: 5px !important; position: relative;";
            let cellContent = "";

            if (i === 0 && j < (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)) {
                calendarHtml += `<td style="${cellStyle} background-color: #f9f9f9;"></td>`;
                continue;
            }

            if (currentDay > daysInMonth) {
                calendarHtml += `<td style="${cellStyle} background-color: #f9f9f9;"></td>`;
                continue;
            }

            const dObj = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), currentDay);
            
            const isOfficial = savedHolidays.includes(currentDay);
            const isWknd = dObj.getDay() === 0 || dObj.getDay() === 6;
            if(isOfficial) cellStyle += "background-color: #ffebee;";
            else if(isWknd) cellStyle += "background-color: #eceff1;";

            let dateNumStyle = "position: absolute; top: 2px; right: 5px; font-weight: bold; font-size: 1rem; color: #757575;";
            if (currentDay === new Date().getDate() && dObj.getMonth() === new Date().getMonth() && dObj.getFullYear() === new Date().getFullYear()) {
                dateNumStyle += "background-color: #26a69a; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; justify-content: center; align-items: center;";
            }
            cellContent += `<span style="${dateNumStyle}">${currentDay}</span>`;

            const daysDiffFromStart = Math.round((dObj - startDateObj) / (1000 * 60 * 60 * 24));
            
            if (daysDiffFromStart >= 0 && daysDiffFromStart < daysDiff) {
                let assignedPersons = personnel.filter((p, pIndex) => assignments[`${pIndex}-${daysDiffFromStart}`]);
                
                if (assignedPersons.length > 0) {
                    cellContent += `<ul style="list-style-type: none; margin: 25px 0 0 0; padding: 0; font-size: 0.85rem; text-align: left;">`;
                    assignedPersons.forEach(p => {
                        const abbreviated = getAbbreviatedName(p.name);
                        cellContent += `<li style="background-color: #f1f8e9; border: 1px solid #c5e1a5; color: #33691e; border-radius: 4px; padding: 2px 5px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${abbreviated}</li>`;
                    });
                    cellContent += `</ul>`;
                }
            }

            calendarHtml += `<td style="${cellStyle}">${cellContent}</td>`;
            currentDay++;
        }
        calendarHtml += `</tr>`;
        if (currentDay > daysInMonth) break;
    }
    calendarHtml += `</tbody></table></div>`;

    document.getElementById('magicLinkCalendarContainer').innerHTML = calendarHtml;
}

async function addToGoogleCalendar() {
    const selectBox = document.getElementById('magicPersonSelect');
    const selectedIndex = selectBox.value;
    
    if (!selectedIndex) {
        M.toast({html: 'Lütfen önce listeden isminizi seçin!', classes: 'red rounded'});
        return;
    }

    const data = window.magicListData;
    const personnel = JSON.parse(data.personnelSnapshot || '[]');
    const personName = personnel[selectedIndex].name;
    const assignments = JSON.parse(data.assignments || '{}');

    // ZAMAN DİLİMİ HATASINI ÖNLEYEN YENİ HESAPLAMA
    const startDate = parseDate(data.startDate);
    const endDateObj = parseDate(data.endDate);
    const daysDiff = daysBetween(data.startDate, data.endDate);

    const dutyDates = [];
    for (let d = 0; d < daysDiff; d++) {
        if (assignments[`${selectedIndex}-${d}`]) {
            const dObj = new Date(startDate);
            dObj.setDate(startDate.getDate() + d);
            dutyDates.push(new Date(dObj));
        }
    }

    if (dutyDates.length === 0) {
        M.toast({html: 'Seçilen isim için bu ay nöbet bulunamadı!', classes: 'blue rounded'});
        return;
    }

    const formatDateLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.events');
        
        M.toast({html: 'Bağlantı kuruluyor...', classes: 'blue'});
        const result = await firebase.auth().signInWithPopup(provider);
        const token = result.credential.accessToken;

        if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
            try {
                const idToken = await result.user.getIdToken();
                fetch("https://api.nobetplani.com", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: result.user.email,
                        name: result.user.displayName,
                        token: idToken,
                        role: "viewer" // <--- PERSONEL
                    })
                }).catch(e => console.error(e));
            } catch(e) {}
        }

        M.toast({html: `${dutyDates.length} nöbet işleniyor...`, classes: 'orange'});

        for (const date of dutyDates) {
            const startStr = formatDateLocal(date);
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            const endStr = formatDateLocal(nextDay);

            const event = {
                'summary': 'Nöbet',
                'description': 'nobetplani.com üzerinden otomatik eklendi.',
                'start': { 'date': startStr },
                'end': { 'date': endStr },
                'reminders': {
                    'useDefault': false,
                    'overrides': [
                        {'method': 'popup', 'minutes': 1440}
                    ]
                }
            };

            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'API Hatası');
            }
        }

        M.toast({html: '✅ Tüm nöbetler takviminize eklendi!', classes: 'green darken-2 rounded', displayLength: 5000});

    } catch (error) {
        console.error("Takvim Hatası:", error);
        M.toast({html: 'Hata: ' + error.message, classes: 'red', displayLength: 8000});
    }
}

function downloadHistoryAsImage(docId) {
    const targetId = `historyCalendarTable_${docId}`;
    const targetElement = document.getElementById(targetId);
    
    if (!targetElement) {
        M.toast({html: 'Tablo bulunamadı!', classes: 'red'});
        return;
    }

    M.toast({html: '📸 Geçmiş liste resim olarak hazırlanıyor...', classes: 'blue', displayLength: 2000});

    const originalMargin = targetElement.style.marginBottom;
    const originalBorder = targetElement.style.borderBottom;
    targetElement.style.marginBottom = "20px"; 
    targetElement.style.borderBottom = "1px solid #ccc";

    html2canvas(targetElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true
    }).then(canvas => {
        // Eski haline getir
        targetElement.style.marginBottom = originalMargin;
        targetElement.style.borderBottom = originalBorder;

        const link = document.createElement('a');
        link.download = `Gecmis_Nobet_Listesi_${docId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        M.toast({html: '✅ Resim indirildi!', classes: 'green'});
    }).catch(err => {
        targetElement.style.marginBottom = originalMargin;
        console.error("Resim hatası:", err);
        M.toast({html: 'Resim oluşturulurken hata oluştu.', classes: 'red'});
    });
}

function shareHistoryAsLink() {
    const data = window.currentViewingHistory;
    if(!data) {
        M.toast({html: 'Veri hatası!', classes: 'red'});
        return;
    }

    M.toast({html: '🔗 Link oluşturuluyor...', classes: 'blue darken-1'});

    const uid = auth.currentUser ? auth.currentUser.uid : 'anon';
    const listId = `liste_${uid}_${data.id}`;

    const shareData = {
        startDate: data.startDate,
        endDate: data.endDate,
        assignments: data.assignments,
        unavailable: data.unavailable,
        personnelSnapshot: data.personnelSnapshot,
        holidays: data.holidays || "",
        isHistoryLink: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = db.collection("public_lists").doc(listId);

    docRef.get().then((doc) => {
        if (doc.exists) {
            return docRef.update(shareData);
        } else {
            return docRef.set({ ...shareData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    })
    .then(() => {
        const magicLink = `https://nobetplani.com/?listeID=${listId}`;
        document.getElementById('generatedMagicLink').value = magicLink;
        window.lastGeneratedScheduleData = shareData;
        const modalElem = document.getElementById('shareLinkModal');
        M.Modal.getInstance(modalElem).open();
    })
    .catch(err => {
        M.toast({html: 'Hata: ' + err.message, classes: 'blue darken-1'});
    });
}
