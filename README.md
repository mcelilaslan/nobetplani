Nöbet Planı - Otomatik Nöbet Listesi Hazırlama Aracı
 
Nöbet Planı, profesyoneller için hızlı, adil ve hatasız nöbet listeleri oluşturmayı sağlayan kullanıcı dostu bir web uygulamasıdır. Sağlık çalışanları, askerler, öğretmenler ve diğer vardiyalı çalışanlar için tasarlanmıştır. Kısıt programlama tabanlı optimizasyon teknikleriyle nöbetleri dengeli bir şekilde dağıtır ve özelleştirilebilir özellikleriyle her türlü ihtiyaca uyum sağlar.

🚀 Özellikler

Otomatik Nöbet Dağıtımı: Tarih aralığı ve nöbetçi sayısı girilerek adil nöbet listeleri oluşturulur.
Hafta İçi ve Hafta Sonu Dengesi: Nöbetler, hafta içi ve hafta sonu için ayrı ayrı dengelenir. Perşembe günleri için özel dengeleme seçeneği.
Gruplama Desteği: Birlikte nöbet tutması gereken personeller aynı gruba atanabilir.
Kişiye Özel Boşluk Ayarları: Her personel için nöbetler arası minimum boşluk süresi belirlenebilir.
Resmi Tatil Entegrasyonu: Resmi tatiller takvimde gri renkte gösterilir ve hafta sonu gibi işlenir.
Önceden Planlama: Kullanıcılar, belirli personel için istenen/istenmeyen günleri önceden belirtebilir.
İzin ve İstirahat Desteği: Personelin izin veya istirahat günleri dikkate alınır.
Çıktı: Nöbet listeleri Excel formatında indirilebilir.
Kullanıcı Dostu Arayüz: Basit ve sezgisel tasarım, kolay kullanım sağlar.


📖 Kullanım Kılavuzu

Tarih aralığını, varsa Resmi Tatil günlerini ve bir nöbette bulunacak olan personel sayısını belirleyerek süreci başlatın.

Personel Ekleme:
Ana ekranda + simgesine tıklayarak personel listenizi oluşturun.
Her personel için hafta içi/hafta sonu nöbet sayıları ve boşluk sürelerini belirleyin.
Nöbetçileri ekledikten sonra CSV dosyası olarak indirerek sonraki liste hazırlamalarında yükleyerek süreci hızlandırabilirsiniz.


Gruplama Mantığı:
Bir nöbette 1'den daha fazla kişi nöbette bulunuyorsa ve birlikte nöbet tutmak isteyen/tutması zorunlu olan kişileri aynı gruba ekleyebilirsiniz.
Aynı mantıkla birlikte nöbet tutmaması gereken kişiler varsa farklı gruplara ekleyerek birlikte nöbet tutmamalarını sağlayabilirsiniz. 
Gruplama mantığı algoritma için katı bir kısıt olmayıp, öncelik olarak alınır.

Nöbet Sayılarını Dağıtma:
"Nöbet Sayılarını Dağıt" butonuna tıklayın.
Sistem, doğrusal optimizasyon kullanarak, kişi başına düşen hafta içi/sonu nöbet sayılarında adil bir dağıtım yapar.

Takvimde İşaretlemeler:
İstenen gün / İstenmeyen Gün switch butonunu kullanarak kişilerin isteklerini takvimde işaretleyin.
Personelin tutmak istediği/tutması zorunlu olduğu günü işaretlemek için "İstenen Gün" modundayken işaretleyin.
Personelin tutmak istemediği/tutmaması zorunlu olduğu günü işaretlemek için "İstenmeyen Gün" modundayken işaretleyin.

Perşembe/Cuma Dengeleme:
Bu kısıtlamaları seçerek algoritmanın bu günleri personel arasında eşit dağıtmasını sağlayabilirsiniz.
Unutmayın bu seçenekler katı kısıtlamalar olup isteğiniz gerçekleşmeyebilir. Bu durumda bu işaretlemeleri kaldırarak tekrar deneyebilirsiniz.

Otomatik Atama:
İşaretlemeler bittiğinde "Otomatik Ata" tuşuna basarak algoritmanın nöbetleri atamasını sağlayabilirsiniz.
İleri/Geri Al tuşu takvimde son yapılan değişiklikleri hatırlar.

Sonuçları İnceleme ve İndirme:
Oluşan takvimi kontrol edin.
Excel formatında indirmek için ilgili butonu kullanın.

⚙️ Teknik Detaylar

Frontend: HTML, JavaScript
Backend: Python(Google Cloud)
Optimizasyon: OR-Tools CP-SAT solver 


🤝 Geri Bildirimde Bulunma
Katkıda bulunmak isterseniz, nobetplani@gmail.com adresine eposta ve instagram adresimizden mesaj atabilir veya footer'da bulunan geri bildirim butonunun kullanabilirsiniz.


E-posta: nobetplani@gmail.com

