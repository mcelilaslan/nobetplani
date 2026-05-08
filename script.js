
        let persons = [];
        let availabilityMode = true;
        let loginSuggestionShown = false; 

        function savePersonsToLocalStorage() {
            // 1. Önce eskisi gibi tarayıcıya kaydet
            localStorage.setItem('nobetPlaniPersonelListesi', JSON.stringify(persons));
            
            // 2. EĞER kullanıcı giriş yapmışsa, buluta da kaydet
            if (auth.currentUser) {
                saveToFirestore();
            }
        }

        function loadPersonsFromLocalStorage() {
            // Hafızadan daha önce kaydedilmiş listeyi okur.
            const savedPersons = localStorage.getItem('nobetPlaniPersonelListesi');
            if (savedPersons) {
                // Kayıtlı liste varsa, bunu geri yükler.
                persons = JSON.parse(savedPersons);
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
                
                        // Önceki seçimleri işaretle
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
                
                        // Gün zaten seçiliyse çıkar, değilse ekle
                        if (index !== -1) {
                            selectedDays.splice(index, 1);
                        } else {
                            selectedDays.push(day);
                        }
                
                        // Günleri sıralı şekilde güncelle
                        selectedDays.sort((a, b) => a - b);
                        holidaysInput.value = selectedDays.join(',');
                
                        // Görsel geri bildirim için seçili günleri işaretle
                        const dayElements = this.el.parentElement.querySelectorAll('.datepicker-day-button');
                        dayElements.forEach(dayEl => {
                            const dayNum = parseInt(dayEl.textContent);
                            if (selectedDays.includes(dayNum)) {
                                dayEl.classList.add('selected-day');
                            } else {
                                dayEl.classList.remove('selected-day');
                            }
                        });
                
                        // Doğrulamayı tetikle
                        M.updateTextFields();
                        holidaysInput.dispatchEvent(new Event('input')); // Materialize’a içeriğin değiştiğini bildir
                        // Manuel doğrulama kontrolü
                        if (selectedDays.length > 0 && holidaysInput.value.match(/^(\d{1,2}(,\d{1,2})*)?$/)) {
                            holidaysInput.classList.remove('invalid');
                            holidaysInput.classList.add('valid');
                        } else {
                            holidaysInput.classList.remove('valid');
                            holidaysInput.classList.add('invalid');
                        }
                    },
                    onClose: function() {
                        // Kapanırken son durumu input’a yaz
                        holidaysInput.value = selectedDays.join(',');
                        M.updateTextFields();
                        holidaysInput.dispatchEvent(new Event('input')); // Materialize’a içeriğin değiştiğini bildir
                        // Manuel doğrulama kontrolü
                        if (selectedDays.length > 0 && holidaysInput.value.match(/^(\d{1,2}(,\d{1,2})*)?$/)) {
                            holidaysInput.classList.remove('invalid');
                            holidaysInput.classList.add('valid');
                        } else {
                            holidaysInput.classList.remove('valid');
                            holidaysInput.classList.add('invalid');
                        }
                    }
                });
                
                // Özel stil için CSS ekleme (seçili günlerin görünümünü değiştirmek için)
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
        
            // Collapsible örneklerini tanımlama
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
        
            // Tarih seçiciler için olay dinleyicileri
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
        
            // Enter tuşu dinleyicisi
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
        
            // CSV yükleme için olay dinleyicisi
            const csvUploadInput = document.getElementById('csvUpload');
            if (csvUploadInput) {
                csvUploadInput.removeEventListener('change', uploadPersonnel);
                csvUploadInput.addEventListener('change', uploadPersonnel);
            } else {
                console.error('csvUpload input elementi bulunamadı!');
            }
        
            // Checkbox'ı varsayılan olarak gizleme
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
            const name = document.getElementById('personName').value.trim().toUpperCase();
            if (!name) return M.toast({html: 'Lütfen isim girin!'});
            if (persons.some(p => p.name === name)) return M.toast({html: 'Bu isim zaten var!'});

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
            M.toast({html: `${name} eklendi!`});
            savePersonsToLocalStorage(); // KAYDET
        }

        function deletePerson(index) {
            const name = persons[index].name;
            persons.splice(index, 1);
            renderTable();
            M.toast({html: `${name} silindi!`});
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

        function truncateName(name) {
            if (isMobileDevice() && name.length > 8) {
                return name.substring(0, 5) + "...";
            }
            return name;
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
                console.log('Group Count:', groupCount);
        
                persons.forEach((person, index) => {
                    let groupOptions = '<option value="0">Seç</option>';
                    for (let i = 1; i <= groupCount; i++) {
                        groupOptions += `<option value="${i}" ${person.group === i ? 'selected' : ''}>${i}</option>`;
                    }
                    
                    html += `
                        <tr style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; background-color: #f9fafb; transition: background-color 0.2s;">
                            ${groupingEnabled && groupCount > 0 ? `
                            <td style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; vertical-align: middle; line-height: 40px; padding: 0 10px; box-sizing: border-box;">
                                <select style="height: 28px; font-size: 13px; border: 1px solid #d1d5db; border-radius: 4px; padding: 0 4px; min-width: ${isMobileDevice() ? '50px' : '30px'}; display: block;" onchange="updateGroup(${index}, this.value)">
                                    ${groupOptions}
                                </select>
                            </td>
                        ` : ''}
                            <td style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; vertical-align: middle; line-height: 40px; padding: 0 10px; box-sizing: border-box; font-family: 'Arial', sans-serif; color: #374151;">
                                ${truncateName(person.name)}
                            </td>
                            <td style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; vertical-align: middle; line-height: 40px; padding: 0 10px; box-sizing: border-box;">
                                <input type="number" class="planning-input" min="0" 
                                    value="${person.weekdayDuties === undefined ? '' : person.weekdayDuties}" 
                                    onchange="updateDuty(${index}, 'weekdayDuties', this.value)"
                                    style="height: 28px; min-height: 28px; max-height: 28px; line-height: 28px; font-size: 13px; margin: 0; padding: 0 6px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; background-color: #ffffff; transition: border-color 0.2s; outline: none; overflow: hidden;">
                            </td>
                            <td style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; vertical-align: middle; line-height: 40px; padding: 0 10px; box-sizing: border-box;">
                                <input type="number" class="planning-input" min="0" 
                                    value="${person.weekendDuties === undefined ? '' : person.weekendDuties}" 
                                    onchange="updateDuty(${index}, 'weekendDuties', this.value)"
                                    style="height: 28px; min-height: 28px; max-height: 28px; line-height: 28px; font-size: 13px; margin: 0; padding: 0 6px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; background-color: #ffffff; transition: border-color 0.2s; outline: none; overflow: hidden;">
                            </td>
                            <td class="duty-gap-cell" style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; vertical-align: middle; line-height: 40px; padding: 0 10px; box-sizing: border-box;">
                                <span style="margin-right: 8px; font-size: 13px; line-height: 28px; height: 28px; display: inline-block; color: #4b5563;">${person.minDaysBetween}</span>
                                <a class="btn-floating btn-small waves-effect waves-light" onclick="decrementDutyGap(${index})"
                                   style="width: 28px; height: 28px; min-height: 28px; max-height: 28px; line-height: 28px; font-size: 12px; margin: 0 4px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #10b981; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: background-color 0.2s; overflow: hidden;">
                                    <i class="material-icons" style="line-height: 28px; font-size: 14px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 28px; width: 28px; color: #ffffff;">arrow_downward</i>
                                </a>
                                <a class="btn-floating btn-small waves-effect waves-light" onclick="incrementDutyGap(${index})"
                                   style="width: 28px; height: 28px; min-height: 28px; max-height: 28px; line-height: 28px; font-size: 12px; margin: 0 4px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #10b981; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: background-color 0.2s; overflow: hidden;">
                                    <i class="material-icons" style="line-height: 28px; font-size: 14px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 28px; width: 28px; color: #ffffff;">arrow_upward</i>
                                </a>
                            </td>
                            <td class="left-align" style="height: 40px; min-height: 40px; max-height: 40px; overflow: hidden; vertical-align: middle; line-height: 40px; padding: 0 10px; box-sizing: border-box;">
                                <a class="btn-floating btn-small" onclick="deletePerson(${index})"
                                   style="width: 28px; height: 28px; min-height: 28px; max-height: 28px; line-height: 28px; font-size: 12px; margin: 0 4px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #ef4444; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: background-color 0.2s; overflow: hidden;">
                                    <i class="material-icons" style="line-height: 28px; font-size: 14px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 28px; width: 28px; color: #ffffff;">delete</i>
                                </a>
                            </td>
                        </tr>
                    `;
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
            // Mevcut uyarıyı kaldır
            const existingAlert = document.querySelector('#calendarAlert');
            if (existingAlert) existingAlert.remove();
        
            // Yeni alert div'i oluştur
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
        
            // Mobil ve masaüstü için konumlandırma
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
        
            // Alert içeriği
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
        
            // Alert'i sayfaya ekle
            document.body.appendChild(alertDiv);
        
            // Bouncing buton etkileşimi
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
        
            // Kutucuk dışında tıklama ile kapatma
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
        
            // İlk tıklamayı yakalamak için kısa bir gecikme (alert’in yerleşmesi için)
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
                M.toast({ html: 'Lütfen en az 3 personel ekleyin!' });
                return;
            }
            
            const startInput = document.getElementById('startDate').value;
            const endInput = document.getElementById('endDate').value;
            const dutyPerDayInput = document.getElementById('dutyPerDay').value.trim();

            if (!dutyPerDayInput || dutyPerDayInput === "") {
                M.toast({ html: 'Kaçar kişinin nöbetçi olacağını belirleyiniz!' });
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
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            const holidayInput = document.getElementById('holidays').value;
            const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

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
                const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
                dates.push({ date: date.toISOString(), isWeekend });
                if (isWeekend) weekendDays++;
                else weekdayDays++;
            }

            const totalDuties = days * dutyPerDay;
            const totalWeekendDuties = weekendDays * dutyPerDay;
            const totalWeekdayDuties = weekdayDays * dutyPerDay;

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
            const displayDates = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                displayDates.push(date);
                html += `<th>${date.getDate()}</th>`;
            }
            html += '</tr>';

            persons.forEach((person, pIndex) => {
                html += `<tr><td class="name-column">${truncateName(person.name)}</td>`;
                dates.forEach((dateObj, dIndex) => {
                    const isWeekend = dateObj.isWeekend;
                    const cellKey = `${pIndex}-${dIndex}`;
                    const isUnavailable = unavailableCells[cellKey];
                    const isSelected = selectedCells[cellKey];

                    html += `
                        <td class="calendar-cell 
                            ${isWeekend ? 'holiday' : ''} 
                            ${isUnavailable ? 'unavailable' : ''} 
                            ${isSelected ? 'selected' : ''}"
                            data-pindex="${pIndex}" 
                            data-dindex="${dIndex}">
                        </td>`;
                });
                html += '</tr>';
            });

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
        
            // Mobil cihaz ve dikey mod kontrolü
            if (isFirstClick && isMobileDevice() && window.innerWidth < window.innerHeight) {
                // Telefonu titreştir
                if (navigator.vibrate) {
                    navigator.vibrate(200); // 200ms titreşim
                }
        
                // Özel mToast uyarısı
                M.Toast.dismissAll();
                const toastHTML = '<span style="font-size: 1rem;">Takvim işaretlemeleri için yatay moda almanız önerilir</span>';
                const toast = M.toast({
                    html: toastHTML,
                    displayLength: 6000,
                    classes: 'shake' // Sallanma animasyonu için sınıf
                });
        
                // Toast elementine shake sınıfını manuel olarak ekle
                setTimeout(() => {
                    const toastElement = document.querySelector('.toast');
                    if (toastElement) {
                        toastElement.classList.add('shake');
                    }
                }, 0);
        
                // İlk tıklamayı false yap
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
            const startInput = document.getElementById('startDate').value;
            const endInput = document.getElementById('endDate').value;
            if (!startInput || !endInput) return;
        
            const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
            const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            const end = new Date(endYear, endMonth - 1, endDay);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
        
            const holidayInput = document.getElementById('holidays').value;
            const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];
            const leaveChecked = document.getElementById('leaveCheckbox').checked;
        
            const stats = persons.map(p => ({name: p.name, weekday: 0, weekend: 0, thursday: 0, friday: 0, overtime: 0}));
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
            for (let d = 0; d < days; d++) {
                const date = new Date(start);
                date.setDate(date.getDate() + d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
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
            const startInput = document.getElementById('startDate').value;
            const endInput = document.getElementById('endDate').value;
            if (!startInput || !endInput) return;

            const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value) || 1;
            const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
            const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            const end = new Date(endYear, endMonth - 1, endDay);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            for (let d = 0; d < days; d++) {
                const assigned = document.querySelectorAll(`td[data-dindex="${d}"].selected`).length;
                if (assigned < dutyPerDay) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    validationErrors.push({
                        type: 'error',
                        message: `${date.toLocaleDateString('tr-TR')} tarihine ${dutyPerDay} nöbetçi atanmamış, atanan: ${assigned}`
                    });
                }
            }

            for (let d = 0; d < days; d++) {
                const assigned = [];
                document.querySelectorAll(`td[data-dindex="${d}"].selected`).forEach(td => {
                    assigned.push(td.closest('tr').querySelector('td:first-child').innerText);
                });
                if (assigned.length > dutyPerDay) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    validationErrors.push({
                        type: 'warning',
                        message: `${date.toLocaleDateString('tr-TR')} tarihinde fazla atama: ${assigned.join(', ')} (${assigned.length} > ${dutyPerDay})`
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

            const holidayInput = document.getElementById('holidays').value;
            const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

            const days = Math.ceil((new Date(document.getElementById('endDate').value.split('-').reverse().join('-')) - start) / (1000 * 60 * 60 * 24)) + 1;
            let weekday = 0, weekend = 0;

            for (let d = 0; d < days; d++) {
                const date = new Date(start);
                date.setDate(date.getDate() + d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
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
                M.toast({ html: 'Lütfen bir paylaşım seçeneği seçin!' });
            }
        }

       function performExport(callback) {
            const startInput = document.getElementById('startDate').value;
            const endInput = document.getElementById('endDate').value;
            const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value) || 1;
            if (!startInput || !endInput) {
                M.toast({ html: 'Lütfen tarih seçin!' });
                return;
            }
        
            const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
            const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            const end = new Date(endYear, endMonth - 1, endDay);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
        
            const holidayInput = document.getElementById('holidays').value;
            const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];
        
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
                const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
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
            const endInput = document.getElementById('endDate').value;
            const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value) || 1;
            const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
            const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            const end = new Date(endYear, endMonth - 1, endDay);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            let allDaysFilled = true;
            for (let d = 0; d < days; d++) {
                const assigned = document.querySelectorAll(`td[data-dindex="${d}"].selected`).length;
                if (assigned < dutyPerDay) {
                    allDaysFilled = false;
                    break;
                }
            }
            if (!allDaysFilled) {
                M.toast({ html: 'Tüm günlere yeteri kadar nöbetçi atanmadı, takvimi doldurun!' });
                return;
            }

            performExport(function(blob, fileName) {
                // 1. İndirme İşlemi
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // Kullanıcıya bilgi ver
                showToast('Dosya cihazınıza indi! 📂 Buluta kayıt işlemi başlatılıyor...', 4000);

                // 2. Otomatik Kaydetme İşlemi (Mevcut kaydet fonksiyonunu tetikler)
                saveScheduleToHistory();
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
            const holidayInput = document.getElementById('holidays').value;
            const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

            const dates = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
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

            for (let d = 0; d < days; d++) {
                let selectedCount = 0;
                for (let p = 0; p < persons.length; p++) {
                    const cellKey = `${p}-${d}`;
                    if (selectedCells[cellKey]) {
                        selectedCount++;
                    }
                }
                if (selectedCount > dutyPerDay) {
                    const date = new Date(start);
                    date.setDate(date.getDate() + d);
                    const dateStr = date.toLocaleDateString('tr-TR');
                    M.toast({ html: `${dateStr} gününe fazla nöbetçi yazdınız! Beklenen: ${dutyPerDay}, Atanan: ${selectedCount}`, displayLength: 8000 });
                    return;
                }
            }

            const totalExpectedDuties = days * dutyPerDay;
            const expectedWeekdayDuties = dates.filter(d => !d.isWeekend).length * dutyPerDay;
            const expectedWeekendDuties = dates.filter(d => d.isWeekend).length * dutyPerDay;

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

            document.getElementById('loadingOverlay').style.display = 'flex';

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

            // Grup kontrolü için ek validation
            const groupingEnabled = document.getElementById('groupingCheckbox').checked;
                        
            // Kontrol 1: Grup büyüklüğü ile dutyPerDay uyumsuzluğu
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
            
                // Kontrol 2: Gruplama seçili ama hiç grup atanmamış
                const hasAnyGroup = persons.some(person => person.group > 0);
                if (!hasAnyGroup) {
                    validationErrors.push({
                        type: 'error',
                        message: '"Birlikte nöbet tutması gerekenler var mı?" seçili, ancak hiç grup atanmamış!'
                    });
                }
            }
            
            // Hata varsa modal aç ve işlemi durdur
            if (validationErrors.length > 0) {
                document.getElementById('loadingOverlay').style.display = 'none';
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
                document.getElementById('loadingOverlay').style.display = 'none';
                
                if (status === 200 && Array.isArray(data.assignments)) {
                    // BAŞARILI DURUM
                    data.assignments.forEach(a => {
                        const cellKey = `${a.pIndex}-${a.dayIndex}`;
                        selectedCells[cellKey] = true;
                    });
                    updateCalendar();
                    updateStatistics();
                    saveToHistory();
                    showToast('Tüm nöbetler başarıyla atandı! 💾 Çıkmadan önce listenizi "Kaydet" butonuyla hesabınıza saklamayı UNUTMAYIN.', 8000);
                } else {
                    // HATA DURUMU
                    let errorMessage = data.error || 'Bilinmeyen bir hata oluştu';
                    
                    // --- AI MESAJI KONTROLÜ ---
                    if (errorMessage.includes('⚠️')) {
                        // 1. "⚠️ ÇÖZÜLEMEDİ:" kısmını temizle ve metni al
                        const rawMessage = errorMessage.replace('⚠️ ÇÖZÜLEMEDİ:', '').trim();
                        
                        // 2. Metni HTML formatına çevir (Yeni satırları <br> yap, maddeleri belirginleştir)
                        // Backend'den gelen madde işaretlerini ( - veya *) HTML listesine çevirebiliriz veya basitçe <br> ekleriz.
                        const formattedMessage = rawMessage.replace(/\n/g, '<br>').replace(/\*/g, '•');

                        // 3. Modal içine yaz
                        document.getElementById('aiReportContent').innerHTML = formattedMessage;

                        // 4. Modalı aç (Kullanıcı tıklayana kadar kapanmaz)
                        const modalElem = document.getElementById('aiModal');
                        const instance = M.Modal.getInstance(modalElem); // Materialize instance'ı al
                        
                        // Eğer instance yoksa (sayfa yeni yüklendiyse) init et
                        if (!instance) {
                            M.Modal.init(modalElem).open();
                        } else {
                            instance.open();
                        }

                    } else {
                        // --- STANDART HATA ---
                        // AI değilse, klasik toast mesajlarını göster
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
                document.getElementById('loadingOverlay').style.display = 'none';
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
                M.toast({ html: 'Dosya yükleme alanı bulunamadı!' });
            }
        }

        function uploadPersonnel(event) {
            if (isUploading) return;

            const file = event.target.files[0];
            if (!file) {
                M.toast({ html: 'Lütfen bir dosya seçin!' });
                return;
            }
            if (!file.name.endsWith('.csv')) {
                M.toast({ html: 'Lütfen geçerli bir CSV dosyası yükleyin!' });
                return;
            }

            isUploading = true;
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.style.display = 'flex';

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
                const headers = rows[0];

                if (headers[0] !== 'İsim') {
                    M.toast({ html: 'Geçersiz CSV formatı! Başlık "İsim" olmalı.' });
                    loadingOverlay.style.display = 'none';
                    isUploading = false;
                    return;
                }

                const newPersons = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (row[0]) {
                        const name = row[0].replace(/"/g, '').trim().toUpperCase();
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
                M.toast({ html: 'Personel listesi başarıyla yüklendi!' });
                loadingOverlay.style.display = 'none';
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
            M.toast({ html: 'Personel listesi CSV olarak indirildi! Sonraki kullanımda buradan yüklemeniz yeterli!' });
        }

        function clearCalendar() {
            saveToHistory();
            selectedCells = {};
            unavailableCells = {};
            updateCalendar();
            updateStatistics();
            M.toast({ html: 'Takvimdeki tüm işaretlemeler temizlendi!' });
        }

        // GEÇMİŞİ DÜZENLEME MODUNA ALMA FONKSİYONU
        function loadHistoryForEditing() {
            const data = window.currentViewingHistory;
            if(!data) return;

            // 1. Modalı kapat
            const modalElem = document.getElementById('historyModal');
            const instance = M.Modal.getInstance(modalElem);
            if(instance) instance.close();

            // 2. Tarih ve Tatil Inputlarını doldur
            document.getElementById('startDate').value = data.startDate;
            document.getElementById('endDate').value = data.endDate;
            document.getElementById('holidays').value = data.holidays || '';
            M.updateTextFields();

            // 3. Personel ve Hücre verilerini geri yükle
            persons = JSON.parse(data.personnelSnapshot || '[]');
            selectedCells = JSON.parse(data.assignments || '{}');
            unavailableCells = JSON.parse(data.unavailable || '{}');
            
            // 4. Günlük Nöbetçi Sayısını (dutyPerDay) Tahmin Et (O gün maksimum kaç kişi nöbetçiyse)
            let maxDuty = 1;
            const [startDay, startMonth, startYear] = data.startDate.split('-').map(Number);
            const [endDay, endMonth, endYear] = data.endDate.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay);
            const end = new Date(endYear, endMonth - 1, endDay);
            const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            for (let d = 0; d < daysCount; d++) {
                let count = 0;
                for(let p = 0; p < persons.length; p++){
                     if(selectedCells[`${p}-${d}`]) count++;
                }
                if(count > maxDuty) maxDuty = count;
            }
            document.getElementById('dutyPerDay').value = maxDuty;

            // 5. Arayüzü güncelle ve takvimi çiz
            renderTable();
            rebuildCalendarForEdit(data.startDate, data.endDate, data.holidays, daysCount, start);

            // 6. Takvime kaydır ve kullanıcıya bilgi ver
            setTimeout(() => {
                document.getElementById('calendarContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
            M.toast({html: 'Liste düzenleme modunda açıldı! Değişiklikleri yapıp Kaydet butonuna basarak üzerine yazabilirsiniz.', classes: 'orange darken-3 rounded', displayLength: 6000});
        }

        // GEÇMİŞ VERİSİ İLE TAKVİMİ SIFIRLAMADAN YENİDEN OLUŞTURMA FONKSİYONU
        function rebuildCalendarForEdit(startInput, endInput, holidayInput, days, start) {
            const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

            const dates = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
                dates.push({ date: date.toISOString(), isWeekend });
            }

            let html = '<tr><th class="name-column">İsim</th>';
            for (let i = 0; i < days; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                html += `<th>${date.getDate()}</th>`;
            }
            html += '</tr>';

            persons.forEach((person, pIndex) => {
                html += `<tr><td class="name-column">${truncateName(person.name)}</td>`;
                dates.forEach((dateObj, dIndex) => {
                    const isWeekend = dateObj.isWeekend;
                    const cellKey = `${pIndex}-${dIndex}`;
                    
                    // İstenmeyen gün ve atanan gün kontrolü burada garanti altına alınıyor
                    const isUnavailable = unavailableCells[cellKey] === true;
                    const isSelected = selectedCells[cellKey] === true;

                    html += `
                        <td class="calendar-cell 
                            ${isWeekend ? 'holiday' : ''} 
                            ${isUnavailable ? 'unavailable' : ''} 
                            ${isSelected ? 'selected' : ''}"
                            data-pindex="${pIndex}" 
                            data-dindex="${dIndex}">
                        </td>`;
                });
                html += '</tr>';
            });

            document.getElementById('calendarTable').innerHTML = html;

            // Event listener'ları tekrar bağla (Tıklama ve sürükleme çalışsın diye)
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

            // Sekmeleri aç ve geçmişi sıfırla (Geri al/İleri al için başlangıç noktası)
            if (collapsiblePersonel) collapsiblePersonel.open(0);
            if (collapsibleCalendar) collapsibleCalendar.open(0);
            updateStatistics();
            history = [];
            historyIndex = -1;
            saveToHistory(); 
        }
        // Geri Bildirim Gönderme Fonksiyonu
        
        function sendFeedback() {
            const email = document.getElementById('feedbackEmail').value.trim();
            const name = document.getElementById('feedbackName').value.trim();
            const message = document.getElementById('feedbackMessage').value.trim();
        
            // Temel alan kontrolü (Ad ve Mesaj zorunlu)
            if (!name || !message) {
                M.toast({ html: 'Lütfen adınızı ve mesajınızı doldurun!' });
                return;
            }
        
            // E-posta boşsa uyarı modalını aç
            if (!email) {
                const modalElem = document.getElementById('emailConfirmModal');
                M.Modal.getInstance(modalElem).open();
            } else {
                // E-posta varsa direkt gönder
                executeFeedbackSend(false);
            }
        }
        
        // 2. Asıl gönderim işlemini yapan fonksiyon
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
        
        // Yardımcı fonksiyon: E-posta alanına odaklanma
        function focusEmailField() {
            setTimeout(() => {
                document.getElementById('feedbackEmail').focus();
            }, 200);
        }
    
        
   
    
