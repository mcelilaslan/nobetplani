
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
    
        
   
    


// ==========================================
// GEÇMİŞ, PAYLAŞIM VE DİĞER FONKSİYONLAR
// (index.html'den taşındı)
// ==========================================


    // Giriş Fonksiyonu
    function googleLogin() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                M.toast({html: 'Hoş geldin ' + user.displayName});
                updateLoginButton(user);
            }).catch((error) => {
                console.error(error);
                M.toast({html: 'Giriş hatası: ' + error.message});
            });
    }

    // Çıkış Fonksiyonu
    function googleLogout() {
        auth.signOut().then(() => {
            M.toast({html: 'Çıkış yapıldı'});
            window.location.reload();
        });
    }

    // Oturum durumunu dinleyen fonksiyon
    // Oturum durumunu dinleyen fonksiyon (GÜNCELLENMİŞ)
    auth.onAuthStateChanged((user) => {
        if (user) {
            updateLoginButton(user);
            loadFromFirestore(user); 

            // 1. Yarım Kalan Kayıt İşlemi Varsa Tamamla
            const pendingSave = sessionStorage.getItem('pendingSaveRequest');
            if (pendingSave === 'true') {
                sessionStorage.removeItem('pendingSaveRequest');
                M.toast({html: 'Giriş başarılı! Listeniz otomatik olarak kaydediliyor...', classes: 'blue darken-1'});
                setTimeout(() => { saveScheduleToHistory(); }, 1500);
            }

            // 2. Geri Bildirim Formunu Otomatik Doldur
            const fbName = document.getElementById('feedbackName');
            const fbEmail = document.getElementById('feedbackEmail');
            if(fbName && fbEmail) {
                fbName.value = user.displayName || '';
                fbEmail.value = user.email || '';
                M.updateTextFields(); 
            }

        } else {
            // Çıkış yapıldıysa formları temizle
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
        // İsimden sadece ilk kelimeyi al 
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Kullanıcı';

        // Masaüstü Görünümü
        const userHtmlDesktop = `
            <a href="#" onclick="googleLogout()" class="btn waves-effect waves-light white black-text tooltipped" data-position="bottom" data-tooltip="Çıkış Yap">
                <img src="${user.photoURL}" style="vertical-align: middle; width: 24px; border-radius: 50%; margin-right: 5px;">
                ${firstName}
            </a>
        `;

        // Mobil Görünümü 
        const userHtmlMobile = `
            <a href="#" onclick="googleLogout()" style="display: flex; align-items: center; padding-left: 32px;">
                <img src="${user.photoURL}" style="vertical-align: middle; width: 24px; border-radius: 50%; margin-right: 15px;">
                ${firstName} (Çıkış)
            </a>
        `;

        // 1. Masaüstü butonunu güncelle
        const loginLiDesktop = document.getElementById('login-li-desktop');
        if(loginLiDesktop) {
            loginLiDesktop.innerHTML = userHtmlDesktop;
        }

        // 2. Mobil butonunu güncelle
        const loginLiMobile = document.getElementById('login-li-mobile');
        if(loginLiMobile) {
            loginLiMobile.innerHTML = userHtmlMobile;
        }
        
        M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    }

    // --- FIRESTORE VERİTABANI İŞLEMLERİ ---

    // 1. Veriyi Buluta Kaydetme Fonksiyonu
    function saveToFirestore() {
        const user = auth.currentUser;
        if (user) {
            // Kullanıcı giriş yapmışsa veriyi buluta yaz
            db.collection("users").doc(user.uid).set({
                personnelList: JSON.stringify(persons), 
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then(() => {
                console.log("Veri buluta yedeklendi.");
            })
            .catch((error) => {
                console.error("Yedekleme hatası: ", error);
            });
        }
    }

    // 2. Veriyi Buluttan Çekme Fonksiyonu
    function loadFromFirestore(user) {
        
        if (persons.length > 0) {
            console.log("Yerel liste dolu, veri kaybını önlemek için buluttan çekme iptal edildi.");
            
            M.toast({
                html: '<span>Mevcut listeniz korundu. (Buluttaki eski liste çekilmedi)</span><button class="btn-flat toast-action" onclick="forceLoadCloud()">Yine de Çek</button>', 
                classes: 'blue darken-3',
                displayLength: 6000
            });
            
            saveToFirestore(); 
            
            return; 
        }

        // Yerel liste boşsa, normal çekme işlemini yap
        db.collection("users").doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().personnelList) {
                const cloudData = JSON.parse(doc.data().personnelList);
                
                if(cloudData.length > 0) {
                    persons = cloudData;
                    renderTable();
                    savePersonsToLocalStorage();
                    M.toast({html: 'Personel listeniz buluttan yüklendi!', classes: 'green'});
                }
            } else {
                // Kullanıcı yeni ise veya bulutta verisi yoksa
                if (persons.length > 0) {
                    saveToFirestore();
                }
            }
        }).catch((error) => {
            console.log("Veri çekme hatası:", error);
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
            // HAFİZA NOTU: Kullanıcı kaydetmeye çalıştı, giriş yapınca hatırlat
            sessionStorage.setItem('pendingSaveRequest', 'true'); 
            
            M.toast({html: 'Kaydetmek için önce giriş yapmalısınız. Giriş ekranı açılıyor...', classes: 'orange darken-2'});
            googleLogin();
            return;
        }

        // Takvim verilerini kontrol et
        const startInput = document.getElementById('startDate').value;
        const endInput = document.getElementById('endDate').value;
        
        if (!startInput || Object.keys(selectedCells).length === 0) {
            M.toast({html: 'Kaydedilecek bir nöbet tablosu yok! Önce takvimi oluşturun ve işaretleme yapın.', classes: 'red'});
            return;
        }

        // --- EKSİK GÜN KONTROLÜ (Senin Orijinal Kodun) ---
       // const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value) || 1;
       // const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
      //  const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
      //  const start = new Date(startYear, startMonth - 1, startDay);
       // const end = new Date(endYear, endMonth - 1, endDay);
        
      //  // Tarih hesaplamaları
      //  start.setHours(0, 0, 0, 0);
      //  end.setHours(0, 0, 0, 0);
        
      //  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
      //  let allDaysFilled = true;
     //   for (let d = 0; d < days; d++) {
      //      const assigned = document.querySelectorAll(`td[data-dindex="${d}"].selected`).length;
       //     if (assigned < dutyPerDay) {
        //        allDaysFilled = false;
       //         break;
       //     }
      //  }
    
     //   if (!allDaysFilled) {
     //       M.toast({ html: 'Tüm günlere yeteri kadar nöbetçi atanmadı, takvimi doldurun!', classes: 'red' });
     //       return;
     //   }
        // -----------------------------------------------------

        // 2. KONTROL: ID Oluşturma (YIL-AY Formatı)
        const [day, month, year] = startInput.split('-'); 
        const docId = `${year}-${month}`;
        
        // --- KRİTİK DÜZELTME BURADA ---
        // Otomatik tetiklendiğinde 'event' olmayabilir, kontrol ediyoruz:
        let btn = null;
        let originalText = 'Kaydet'; // Varsayılan metin

        // Eğer bu fonksiyon bir tıklama ile çağrıldıysa ve event varsa:
        if (typeof event !== 'undefined' && event && event.target) {
            btn = event.target.closest('button');
            if (btn) {
                originalText = btn.innerHTML;
                btn.innerHTML = '<i class="material-icons left">hourglass_empty</i>Kontrol...';
                btn.classList.add('disabled');
            }
        }

        // Veritabanı Referansı
        const docRef = db.collection("users").doc(user.uid).collection("history").doc(docId);

        // 3. KONTROL: Veri Var mı? (Çakışma Kontrolü)
        docRef.get().then((doc) => {
            if (doc.exists) {
                // Kayıt varsa butonu eski haline getir
                if(btn) resetButton(btn, originalText);
                
                // Modalı tetikle
                openOverwriteModal(docRef, startInput, endInput, btn, originalText, month, year);
            } else {
                // KAYIT YOKSA -> Direkt Kaydet
                performSave(docRef, startInput, endInput, btn, originalText);
            }
        }).catch((error) => {
            console.error("Kontrol hatası:", error);
            M.toast({html: 'Veritabanı kontrol edilemedi: ' + error.message, classes: 'red'});
            if(btn) resetButton(btn, originalText);
        });
    }

    // --- ONAY PENCERESİNİ AÇAN YARDIMCI FONKSİYON ---
    function openOverwriteModal(docRef, startInput, endInput, btn, originalText, month, year) {
        const modalElem = document.getElementById('overwriteModal');
        const instance = M.Modal.getInstance(modalElem); 
        
        const monthName = getMonthName(parseInt(month)); 
        
        // Mesajı hazırla
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

    // Yardımcı Kayıt Fonksiyonu
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
                M.toast({html: '✅ Nöbet listesi başarıyla kaydedildi!', classes: 'green darken-2'});
                
                if (btn) {
                    btn.innerHTML = '<i class="material-icons left">check</i>Tamam';
                    setTimeout(() => resetButton(btn, originalText), 2000);
                }
            })
            .catch((error) => {
                console.error("Kaydetme hatası: ", error);
                M.toast({html: 'Hata: ' + error.message, classes: 'red'});
                
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

    // Modal açıldığında listeyi yükle
    document.addEventListener('DOMContentLoaded', function() {
        const historyModalElem = document.getElementById('historyModal');
        M.Modal.init(historyModalElem, {
            onOpenStart: loadHistoryList // Modal açılırken bu fonksiyonu çalıştır
        });
    });

    
    // Global değişkenler(geçmiş)
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

    // Ekranı sıfırla (Orijinal Kodun Başlangıcı)
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

            // --- KÜMÜLATİF İSTATİSTİKLER ---
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
                // --- YIL BAŞLIĞI (Açılır/Kapanır Menü) ---
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

                // --- AYLARI LİSTELE ---
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
    // --- TEKİL AY DETAYI ---
    function showHistoryDetail(data) {
        highlightActiveItem(event.currentTarget);
        
        window.currentViewingHistory = data; // EKLENDİ: Düzenleme için veriyi hafızaya al

        // Görünüm Ayarları
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

    // Dropdown'u manuel başlat (Dinamik eklendiği için gerekli)
    const shareBtn = document.querySelector('.dropdown-trigger[data-target="historyShareDropdown"]');
    if(shareBtn) M.Dropdown.init(shareBtn, { coverTrigger: false, constrainWidth: false });

        // İstatistikleri Hesapla ve Tabloyu Bas
        const contentDiv = document.getElementById('historyStatsContent');
        const stats = calculateStatsForDoc(data); 
        
        contentDiv.innerHTML = generateStatsTableHTML(stats) + generateMiniCalendarHTML(data);
    }

    // --- KÜMÜLATİF İSTATİSTİK GÖRÜNÜMÜ ---
    function showCumulativeView() {
        if(event && event.currentTarget) highlightActiveItem(event.currentTarget);

        document.getElementById('historyPlaceholder').style.display = 'none';
        document.getElementById('historyDetail').style.display = 'block';
        document.getElementById('yearFilterContainer').style.display = 'block'; // Yıl filtresini göster

        document.getElementById('historyDetailTitle').innerText = "Kümülatif Toplamlar";
        document.getElementById('historyActions').innerHTML = ""; 

        // 1. Mevcut Yılları Bul
        const years = new Set();
        window.allHistoryDocs.forEach(d => {
            const y = d.id.split('-')[0];
            years.add(y);
        });
        const sortedYears = Array.from(years).sort();

        // 2. Yıl Butonlarını Oluştur
        const btnContainer = document.getElementById('yearButtons');
        btnContainer.innerHTML = "";
        
        const currentYear = new Date().getFullYear().toString();
        // Varsayılan olarak mevcut yılı veya en son yılı seç
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

    // --- YARDIMCI HESAPLAMA FONKSİYONLARI ---

    function calculateStatsForDoc(data) {
    const assignments = JSON.parse(data.assignments || '{}');
    const personnel = JSON.parse(data.personnelSnapshot || '[]');
    const savedHolidays = (data.holidays || "").split(',').map(d => parseInt(d)).filter(n => !isNaN(n));
    
    
    const [startDay, startMonth, startYear] = data.startDate.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const [endDay, endMonth, endYear] = data.endDate.split('-').map(Number);
    const endDateObj = new Date(endYear, endMonth - 1, endDay);
    const daysDiff = Math.round((endDateObj - startDate) / (1000 * 60 * 60 * 24)) + 1;

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
    const savedHolidays = (data.holidays || "").split(',').map(d => parseInt(d)).filter(n => !isNaN(n));
    
    
    const [startDay, startMonth, startYear] = data.startDate.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const [endDay, endMonth, endYear] = data.endDate.split('-').map(Number);
    const endDateObj = new Date(endYear, endMonth - 1, endDay);
    const daysDiff = Math.round((endDateObj - startDate) / (1000 * 60 * 60 * 24)) + 1;

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
        // 1. İlgili belgenin verilerini geçmiş hafızasından bul
        const data = window.allHistoryDocs.find(d => d.id === docId);
        if (!data) {
            M.toast({html: 'Veri bulunamadı!', classes: 'red'});
            return;
        }

        // 2. Veritabanından gelen verileri çözümle
        const assignments = JSON.parse(data.assignments || '{}');
        const personnel = JSON.parse(data.personnelSnapshot || '[]');
        const holidayInput = data.holidays || "";
        const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

        const [startDay, startMonth, startYear] = data.startDate.split('-').map(Number);
        const [endDay, endMonth, endYear] = data.endDate.split('-').map(Number);
        const start = new Date(startYear, startMonth - 1, startDay);
        const end = new Date(endYear, endMonth - 1, endDay);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const scheduleData = {};

        // 3. Gün gün kimlerin nöbetçi olduğunu tespit et
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

        // 4. En yoğun gündeki nöbetçi sayısını (Sütun miktarını) bul
        let columnCount = 1;
        for (const date in scheduleData) {
            columnCount = Math.max(columnCount, scheduleData[date].length);
        }

        // 5. Excel için stilli veriyi hazırla (Ana sayfa formatının aynısı)
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

            const row = [{ v: dateStr, t: 's', s: dateStyle }]; 
            const assigned = scheduleData[dateStr] || [];
            for (let i = 0; i < columnCount; i++) {
                row.push({ v: assigned[i] || '', t: 's', s: { font: { sz: 16 } } }); 
            }
            styledData.push(row);
        }

        // 6. Dosyayı oluştur, sütun genişliklerini ayarla ve indir
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
                // Diğer ayların seçimi kalktığında arka planı ve yazıyı koyu renge döndür
                i.style.backgroundColor = '';
                i.style.color = '#374151'; 
            }
        });
        elem.classList.add('active', 'teal');
        elem.style.backgroundColor = ''; 
        elem.style.color = 'white';
    }

    
    // RESİM İNDİRME VE PAYLAŞMA
   
function downloadAsImage() {
    const targetElement = document.getElementById('calendarTable');
    
    if (!targetElement || targetElement.innerHTML.trim() === '') {
        M.toast({html: 'İndirilecek bir takvim bulunamadı!', classes: 'red rounded'});
        return;
    }

    M.toast({html: '📸 Fotoğraf hazırlanıyor, lütfen bekleyin...', classes: 'blue rounded', displayLength: 2000});

    // 1. KESİN ÇÖZÜM: Alt satır kaymasını önleyen dış boşluk (Margin)
    const originalMargin = targetElement.style.marginBottom;
    const originalBorder = targetElement.style.borderBottom;
    targetElement.style.marginBottom = "20px"; 
    targetElement.style.borderBottom = "1px solid #ccc";

    // 2. İstenmeyen günleri (kırmızı çarpıları) fotoğrafta gizle
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

        // Çarpıları senin ekranına geri getir
        const tempCells = targetElement.querySelectorAll('.temp-unavailable');
        tempCells.forEach(cell => {
            cell.classList.remove('temp-unavailable');
            cell.classList.add('unavailable');
        });

        // Resmi indir
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Nobet_Listesi_${new Date().toISOString().split('T')[0]}.png`;
        link.href = imgData;
        link.click();
        M.toast({html: '✅ Fotoğraf başarıyla cihazınıza indirildi!', classes: 'green darken-2 rounded'});
    }).catch(err => {
        // Hata olursa da ekranı bozuk bırakma
        targetElement.style.marginBottom = originalMargin;
        targetElement.style.borderBottom = originalBorder;
        const tempCells = targetElement.querySelectorAll('.temp-unavailable');
        tempCells.forEach(cell => {
            cell.classList.remove('temp-unavailable');
            cell.classList.add('unavailable');
        });

        console.error("Resim hatası:", err);
        M.toast({html: 'Resim oluşturulurken bir hata oluştu.', classes: 'red rounded'});
    });
}

// YENİ: Modern Paylaşım Modalı ve Link Üretimi
function createMagicLink(btn) {
    const startInput = document.getElementById('startDate').value;
    if (!startInput || Object.keys(selectedCells).length === 0) {
        M.toast({html: 'Paylaşılacak bir liste yok! Önce takvimi oluşturun.', classes: 'red rounded'});
        return;
    }

    if (!auth.currentUser) {
        M.toast({html: 'Paylaşım linki oluşturmak için giriş yapmalısınız.', classes: 'orange darken-2'});
        googleLogin();
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="material-icons left">loop</i>Bekleyin...';
    btn.classList.add('disabled');

    // Deterministik ID: aynı ay için her zaman aynı belge -> duplicate oluşmaz
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

    // Önce kontrol et: bu ay için zaten belge var mı?
    docRef.get().then((doc) => {
        if (doc.exists) {
            // Var: veriyi güncelle (link aynı kalır)
            return docRef.update(scheduleData);
        } else {
            // Yok: yeni oluştur
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
            M.toast({html: 'Paylaşım linki oluşturulamadı: ' + error.message, classes: 'red rounded'});
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
        M.toast({html: '✅ Link başarıyla kopyalandı! WhatsApp\'a yapıştırabilirsiniz.', classes: 'green darken-2 rounded', displayLength: 4000});
    }).catch(err => {
        M.toast({html: 'Kopyalama başarısız, lütfen manuel kopyalayın.', classes: 'red rounded'});
    });
}

// Asıl kullanıcının doğrudan takvimine eklemesini sağlayan köprü fonksiyon
function openAdminCalendarModal() {
    // 1. Önce paylaşım modalını kapat
    const shareModalElem = document.getElementById('shareLinkModal');
    const shareModal = M.Modal.getInstance(shareModalElem);
    if(shareModal) shareModal.close();

    //Var olan link modalını eldeki verilerle aç
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
// SİHİRLİ LİNK OKUMA VE KARŞILAMA EKRANI
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    // URL'de listeID var mı kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const listeID = urlParams.get('listeID');

    if (listeID) {
        // Modalı tanımla ve dışarı tıklanarak kapanmasını engelle
        const magicModalElem = document.getElementById('magicLinkModal');
        const magicModal = M.Modal.init(magicModalElem, { dismissible: false });
        
        M.toast({html: 'Paylaşılan liste yükleniyor...', classes: 'blue rounded', displayLength: 2000});
        
        // Firestore'dan veriyi çek
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
    const savedHolidays = (data.holidays || "").split(',').map(d => parseInt(d)).filter(n => !isNaN(n));
    
    // ZAMAN DİLİMİ HATASINI ÖNLEYEN HESAPLAMA (Tarih aralığı için)
    const [startDay, startMonth, startYear] = data.startDate.split('-').map(Number);
    const startDateObj = new Date(startYear, startMonth - 1, startDay);
    const [endDay, endMonth, endYear] = data.endDate.split('-').map(Number);
    const endDateObj = new Date(endYear, endMonth - 1, endDay);
    const daysDiff = Math.round((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

    // Seçim Kutusunu Doldur (Değişmedi)
    const selectBox = document.getElementById('magicPersonSelect');
    selectBox.innerHTML = '<option value="" disabled selected>Listeden isminizi bulun...</option>';
    personnel.forEach((p, index) => {
        selectBox.innerHTML += `<option value="${index}">${p.name}</option>`;
    });

    // --- GOOGLE TAKVİM TARZI AYLIK GRID ÇİZİMİ ---
    const monthName = startDateObj.toLocaleString('tr-TR', { month: 'long' });
    const yearNum = startDateObj.getFullYear();
    const firstDayOfMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 1);
    const lastDayOfMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0: Pazar, 1: Pzt, ...

    // Haftanın Günleri Başlıkları (Days of Week)
    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    let calendarHtml = `<h6 class="teal-text center-align" style="font-weight:bold; margin-top:20px; font-size:1.3rem;">${monthName} ${yearNum} Nöbetleri</h6>
                    <div style="overflow-x:auto;">
                    <table class="centered magic-calendar-table" style="border:1px solid #eee; border-collapse: collapse; width: 100%;">
                    <thead><tr style="border-bottom: 2px solid #26a69a;">`;
    
    dayNames.forEach(day => {
        calendarHtml += `<th style="padding: 10px 5px; font-weight: bold; color: #26a69a; border: 1px solid #ddd; width: 14.28%;">${day}</th>`;
    });
    calendarHtml += `</tr></thead><tbody>`;

    // Grid'i Oluşturma (4-5 hafta)
    let currentDay = 1;
    for (let i = 0; i < 6; i++) { // Max 6 hafta
        calendarHtml += `<tr>`;
        for (let j = 0; j < 7; j++) {
            let cellStyle = "border: 1px solid #ddd; width: 14.28%; height: 95px; vertical-align: top; padding: 5px !important; position: relative;";
            let cellContent = "";

            // Ayın ilk gününe kadar boşluk
            if (i === 0 && j < (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)) {
                calendarHtml += `<td style="${cellStyle} background-color: #f9f9f9;"></td>`;
                continue;
            }

            // Ayın bittiği yer
            if (currentDay > daysInMonth) {
                calendarHtml += `<td style="${cellStyle} background-color: #f9f9f9;"></td>`;
                continue;
            }

            // --- BUGÜNÜN HÜCRESİNİ DOLDUR ---
            const dObj = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), currentDay);
            
            // Hafta sonu / Resmî Tatil Stili
            const isOfficial = savedHolidays.includes(currentDay);
            const isWknd = dObj.getDay() === 0 || dObj.getDay() === 6;
            if(isOfficial) cellStyle += "background-color: #ffebee;";
            else if(isWknd) cellStyle += "background-color: #eceff1;";

            // Tarih Numarası (Sağ Üstte)
            let dateNumStyle = "position: absolute; top: 2px; right: 5px; font-weight: bold; font-size: 1rem; color: #757575;";
            if (currentDay === new Date().getDate() && dObj.getMonth() === new Date().getMonth() && dObj.getFullYear() === new Date().getFullYear()) {
                dateNumStyle += "background-color: #26a69a; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; justify-content: center; align-items: center;";
            }
            cellContent += `<span style="${dateNumStyle}">${currentDay}</span>`;

            // --- NÖBETÇİLERİ BUL VE LİSTELE ---
            // Bu günün sihirli link tarih aralığı içinde olup olmadığını kontrol et
            const daysDiffFromStart = Math.round((dObj - startDateObj) / (1000 * 60 * 60 * 24));
            
            if (daysDiffFromStart >= 0 && daysDiffFromStart < daysDiff) {
                // Nöbetçilerin isimlerini topla
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

// Takvime Ekle
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
    const [startDay, startMonth, startYear] = data.startDate.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const [endDay, endMonth, endYear] = data.endDate.split('-').map(Number);
    const endDateObj = new Date(endYear, endMonth - 1, endDay);
    const daysDiff = Math.round((endDateObj - startDate) / (1000 * 60 * 60 * 24)) + 1;

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

    // YEREL TARİHİ KORUYAN YARDIMCI FONKSİYON (Timezone hatasını önler)
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

    // 1. Geçmişteki Listeyi Resim Olarak İndir 
function downloadHistoryAsImage(docId) {
    const targetId = `historyCalendarTable_${docId}`;
    const targetElement = document.getElementById(targetId);
    
    if (!targetElement) {
        M.toast({html: 'Tablo bulunamadı!', classes: 'red'});
        return;
    }

    M.toast({html: '📸 Geçmiş liste resim olarak hazırlanıyor...', classes: 'blue', displayLength: 2000});

    // Kayma sorununu önleyen geçici görsel düzeltmeler
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

    M.toast({html: '🔗 Link oluşturuluyor...', classes: 'blue'});

    // Deterministik ID: history doc ID zaten yıl-ay formatında (ör: 2025-06)
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
        M.toast({html: 'Hata: ' + err.message, classes: 'red'});
    });
}
