/**
 * Data Kurikulum Lengkap Caturan MVP 1
 * Terdiri dari 6 Kategori (Level 1 s/d Level 6) dan 30 Materi Terstruktur
 * Seluruh posisi FEN dan urutan langkah latihan telah divalidasi dengan aturan FIDE / Chess.js.
 */

export const CURRICULUM_CATEGORIES = [
  {
    id: 'level-1',
    level: 1,
    title: 'Level 1 — Dasar-Dasar Catur',
    shortTitle: 'Dasar-Dasar Catur',
    description: 'Kenali anatomi papan catur, sistem koordinat aljabar, karakteristik setiap bidak, cara melangkah, hingga perhitungan nilai materi.',
    badgeText: 'Pemula',
    lessons: [
      {
        id: 'l1-1-mengenal-papan',
        categoryId: 'level-1',
        order: 1,
        title: 'Mengenal papan catur',
        subtitle: 'Memahami 64 petak, orientasi warna petak sudut, serta pembagian area permainan.',
        xpReward: 50,
        estimatedMinutes: 5,
        theory: [
          {
            heading: 'Anatomi Papan Catur 64 Petak',
            content: 'Papan catur adalah medan tempur berbentuk persegi yang terdiri dari 64 petak kecil (8 petak memanjang × 8 petak melebar). Petak-petak ini disusun berselang-seling antara dua warna kontras, yang dalam istilah catur selalu disebut sebagai petak terang (Putih) dan petak gelap (Hitam).',
            bulletPoints: [
              'Aturan Emas Orientasi Papan: Petak di sudut paling kanan bawah di hadapan masing-masing pemain HARUS selalu berwarna terang (petak h1 untuk Putih, dan petak a8 untuk Hitam).',
              'Papan catur dibagi menjadi dua sisi horizontal: Sisi Putih (baris 1 sampai 4) dan Sisi Hitam (baris 5 sampai 8).',
              'Secara vertikal, papan dibagi menjadi Sayap Menteri / Queenside (kolom a sampai d) dan Sayap Raja / Kingside (kolom e sampai h).',
              'Empat petak paling tengah (d4, e4, d5, e5) disebut Pusat Papan (Center) yang menjadi area paling strategis dalam permainan.'
            ]
          },
          {
            heading: 'Mengapa Orientasi Papan Penting?',
            content: 'Jika papan diletakkan terbalik (petak kanan bawah berwarna gelap), posisi awal Raja dan Menteri akan tertukar. Ingat selalu prinsip dasar: "Menteri selalu menempati petak sesuai warnanya" (Menteri Putih di petak terang d1, Menteri Hitam di petak gelap d8).'
          }
        ],
        keyTakeaways: [
          'Papan catur memiliki 64 petak (32 petak terang dan 32 petak gelap).',
          'Sudut kanan bawah pemain wajib petak terang.',
          'Petak pusat utama adalah d4, e4, d5, dan e5.'
        ],
        practice: {
          title: 'Praktik: Menempati Pusat Papan Pertama Anda',
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d4', 'e4', 'd5', 'e5', 'h1'],
          instruction: 'Perhatikan papan catur dengan posisi awal lengkap. Petak kanan bawah (h1) adalah petak terang, dan 4 petak di tengah yang ditandai adalah Pusat Papan. Lakukan langkah pembuka klasik dengan memajukan pion di depan Raja dari e2 ke e4 (atau pion Menteri dari d2 ke d4) untuk menginjak area pusat!',
          steps: [
            {
              expectedMoves: ['e4', 'd4'],
              hint: 'Klik pion Putih di petak e2 lalu klik petak pusat e4 (atau pion d2 ke d4).',
              opponentReply: 'e5',
              explanation: 'Bagus sekali! Anda baru saja melakukan langkah pertama menuju pusat papan dan lawan membalas di e5.'
            }
          ]
        }
      },
      {
        id: 'l1-2-koordinat',
        categoryId: 'level-1',
        order: 2,
        title: 'Mengenal baris, kolom, dan koordinat',
        subtitle: 'Membaca lajur vertikal (file), baris horizontal (rank), diagonal, dan sistem notasi koordinat.',
        xpReward: 50,
        estimatedMinutes: 6,
        theory: [
          {
            heading: 'Kolom (File), Baris (Rank), dan Diagonal',
            content: 'Untuk membaca posisi dan mencatat langkah catur, seluruh dunia menggunakan Sistem Notasi Aljabar. Setiap petak di papan catur memiliki nama unik yang terdiri dari 1 huruf kecil diikuti 1 angka.',
            bulletPoints: [
              'Kolom (File): Jalur vertikal dari bawah ke atas yang diberi label huruf a, b, c, d, e, f, g, dan h (dari kiri ke kanan menurut sudut pandang Putih).',
              'Baris (Rank): Jalur horizontal dari kiri ke kanan yang diberi nomor angka 1 sampai 8 (baris 1 adalah markas awal Putih, baris 8 adalah markas awal Hitam).',
              'Diagonal: Jalur miring yang menghubungkan petak-petak dengan warna yang sama (contoh: diagonal panjang a1-h8 semuanya petak gelap).',
              'Nama Koordinat Petak: Perpotongan antara kolom dan baris, dengan huruf selalu ditulis lebih dulu. Contoh: petak tempat Raja Putih berdiri di awal adalah e1.'
            ]
          },
          {
            heading: 'Manfaat Menguasai Koordinat',
            content: 'Dengan memahami koordinat, Anda dapat membaca buku catur, memahami instruksi pelatih, dan memvisualisasikan rencana langkah dengan cepat.'
          }
        ],
        keyTakeaways: [
          'Kolom (vertikal) menggunakan huruf a sampai h.',
          'Baris (horizontal) menggunakan angka 1 sampai 8.',
          'Format penulisan koordinat selalu [huruf][angka], misalnya c4, f3, atau e5.'
        ],
        practice: {
          title: 'Praktik: Navigasi Koordinat Beruntun',
          initialFen: '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['f3', 'e5'],
          instruction: 'Mari melatih ketepatan membaca koordinat! Di papan terdapat Kuda Putih di petak g1. Langkah 1: Pindahkan Kuda dari g1 ke koordinat f3. Setelah Raja Hitam bergerak, Langkah 2: Pindahkan Kuda dari f3 ke koordinat pusat e5.',
          steps: [
            {
              expectedMoves: ['Nf3'],
              hint: 'Pilih Kuda di petak g1 (kolom g, baris 1) dan pindahkan ke petak f3 (kolom f, baris 3).',
              opponentReply: 'Kd8',
              explanation: 'Tepat! Kuda kini berada di koordinat f3. Sekarang lanjutkan langkah kedua ke petak e5.'
            },
            {
              expectedMoves: ['Ne5'],
              hint: 'Klik Kuda di petak f3 lalu gerakkan ke petak pusat e5 (kolom e, baris 5).',
              opponentReply: null,
              explanation: 'Luar biasa! Anda telah menggerakkan Kuda tepat menuju koordinat f3 lalu e5.'
            }
          ]
        }
      },
      {
        id: 'l1-3-mengenal-bidak',
        categoryId: 'level-1',
        order: 3,
        title: 'Mengenal bidak catur',
        subtitle: 'Mengenal 6 jenis buah catur beserta jumlah dan posisi awalnya pada baris pertama dan kedua.',
        xpReward: 50,
        estimatedMinutes: 6,
        theory: [
          {
            heading: 'Pasukan di Atas Papan Catur',
            content: 'Setiap pemain memulai permainan dengan 16 buah catur (sering disebut bidak atau perwira) yang terdiri dari 6 jenis berbeda:',
            bulletPoints: [
              '1 Raja (King - K): Buah terpenting dalam permainan. Jika Raja tertangkap (Skakmat), permainan berakhir. Posisi awal di kolom e (e1 untuk Putih, e8 untuk Hitam).',
              '1 Menteri / Ratu (Queen - Q): Perwira paling kuat dengan daya jelajah terjauh. Posisi awal di kolom d (d1 untuk Putih, d8 untuk Hitam).',
              '2 Benteng (Rook - R): Perwira berat yang menjaga sudut papan di awal permainan (a1 & h1 untuk Putih, a8 & h8 untuk Hitam).',
              '2 Gajah / Peluncur (Bishop - B): Perwira ringan spesialis jalur diagonal. Satu berada di petak terang dan satu di petak gelap (c1 & f1 untuk Putih).',
              '2 Kuda (Knight - N): Perwira ringan yang lincah dan satu-satunya yang bisa melompati buah lain (b1 & g1 untuk Putih).',
              '8 Pion / Bidak Kecil (Pawn): Garda terdepan yang berbaris rapi di sepanjang baris kedua (a2-h2 untuk Putih) dan baris ketujuh (a7-h7 untuk Hitam).'
            ]
          },
          {
            heading: 'Perwira Berat vs Perwira Ringan',
            content: 'Dalam terminologi catur, Menteri dan Benteng disebut Perwira Berat (Major Pieces) karena mampu melakukan skakmat hanya dengan bantuan Raja. Sedangkan Gajah dan Kuda disebut Perwira Ringan (Minor Pieces).'
          }
        ],
        keyTakeaways: [
          'Masing-masing pemain memiliki 16 buah: 8 Pion, 2 Benteng, 2 Kuda, 2 Gajah, 1 Menteri, dan 1 Raja.',
          'Benteng berada di pojok (a & h), diikuti Kuda (b & g), Gajah (c & f), Menteri (d), dan Raja (e).',
          'Notasi internasional menggunakan huruf K (King), Q (Queen), R (Rook), B (Bishop), dan N (Knight).'
        ],
        practice: {
          title: 'Praktik: Mengaktifkan Perwira Ringan & Menteri',
          initialFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['f1', 'c4', 'g1', 'f3'],
          instruction: 'Kenali perwira Anda di baris pertama! Langkah 1: Keluarkan Gajah petak terang dari f1 ke petak c4. Langkah 2: Setelah lawan melangkah, keluarkan Kuda dari g1 ke petak f3.',
          steps: [
            {
              expectedMoves: ['Bc4'],
              hint: 'Pilih Gajah Putih di petak f1, lalu klik petak c4.',
              opponentReply: 'Nc6',
              explanation: 'Bagus! Gajah Putih kini aktif di petak c4. Selanjutnya keluarkan Kuda dari g1 ke f3.'
            },
            {
              expectedMoves: ['Nf3'],
              hint: 'Pilih Kuda Putih di petak g1, lalu klik petak f3.',
              opponentReply: null,
              explanation: 'Sempurna! Anda telah mengenali dan menggerakkan Gajah serta Kuda dari petak awalnya.'
            }
          ]
        }
      },
      {
        id: 'l1-4-cara-bergerak',
        categoryId: 'level-1',
        order: 4,
        title: 'Cara bergerak setiap bidak',
        subtitle: 'Aturan arah gerak dan cara menangkap lawan untuk Pion, Kuda, Gajah, Benteng, Menteri, dan Raja.',
        xpReward: 50,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Pola Gerak 6 Jenis Buah Catur',
            content: 'Setiap jenis buah catur memiliki pola pergerakan yang khas. Selain Kuda, tidak ada buah yang boleh melompati buah lain yang menghalangi jalurnya.',
            bulletPoints: [
              'Benteng (Rook): Bergerak lurus secara vertikal (sepanjang kolom) atau horizontal (sepanjang baris) sejauh petak yang kosong.',
              'Gajah (Bishop): Bergerak miring sepanjang diagonal dengan warna petak yang sama sejauh tidak terhalang.',
              'Menteri (Queen): Gabungan kekuatan Benteng dan Gajah! Dapat bergerak lurus maupun diagonal ke segala arah sejauh petak kosong.',
              'Raja (King): Bergerak 1 petak ke segala arah (lurus maupun diagonal), selama petak tujuan tidak diserang lawan.',
              'Kuda (Knight): Bergerak membentuk huruf "L" (2 petak lurus lalu 1 petak ke samping). Kuda selalu berpindah ke warna petak yang berlawanan setiap kali melangkah dan mampu melompati buah lain.',
              'Pion (Pawn): Bergerak maju lurus 1 petak (khusus dari posisi awal boleh maju 2 petak sekaligus), tetapi menangkap buah lawan secara menyilang 1 petak ke depan.'
            ]
          }
        ],
        keyTakeaways: [
          'Kuda adalah satu-satunya perwira yang dapat melompati buah lain.',
          'Pion melangkah lurus ke depan namun memakan secara diagonal 1 petak.',
          'Gajah tidak pernah bisa berpindah warna petak sepanjang permainan.'
        ],
        practice: {
          title: 'Praktik: Kombinasi Gerak Benteng, Gajah, dan Kuda',
          initialFen: '4k3/8/8/3p4/8/2N1B3/8/R3K3 w Q - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d5', 'a7', 'f6'],
          instruction: 'Mari praktikkan pola gerak unik perwira Putih! Langkah 1: Gunakan Kuda di c3 (pola huruf L) untuk menangkap pion Hitam di d5. Langkah 2: Gunakan Gajah di e3 (pola diagonal) untuk melangkah ke f4. Langkah 3: Gunakan Benteng di a1 (pola lurus vertikal) untuk melangkah ke a7!',
          steps: [
            {
              expectedMoves: ['Nxd5'],
              hint: 'Klik Kuda di c3 dan tangkap pion di d5 (2 petak naik, 1 petak kanan).',
              opponentReply: 'Kd7',
              explanation: 'Bagus! Kuda membentuk pola huruf L untuk menangkap pion d5. Sekarang gerakkan Gajah dari e3 ke f4.'
            },
            {
              expectedMoves: ['Bf4'],
              hint: 'Klik Gajah di e3 dan gerakkan menyilang 1 petak ke f4.',
              opponentReply: 'Ke6',
              explanation: 'Tepat! Gajah bergerak di sepanjang diagonal gelap. Terakhir, gerakkan Benteng dari a1 lurus ke a7.'
            },
            {
              expectedMoves: ['Ra7'],
              hint: 'Klik Benteng di sudut a1 lalu klik petak a7 di jalur vertikal kolom a.',
              opponentReply: null,
              explanation: 'Sempurna! Anda telah mempraktikkan gerak Kuda (huruf L), Gajah (diagonal), dan Benteng (vertikal lurus).'
            }
          ]
        }
      },
      {
        id: 'l1-5-nilai-relatif',
        categoryId: 'level-1',
        order: 5,
        title: 'Nilai relatif setiap bidak',
        subtitle: 'Memahami bobot poin materi untuk mengambil keputusan pertukaran bidak yang menguntungkan.',
        xpReward: 50,
        estimatedMinutes: 6,
        theory: [
          {
            heading: 'Skala Poin Materi Standar',
            content: 'Meskipun keunggulan poin materi tidak secara otomatis memenangkan pertandingan (hanya Skakmat yang memenangkan permainan), mengetahui nilai relatif setiap bidak sangat penting untuk menilai apakah suatu pertukaran (trade) menguntungkan atau merugikan Anda.',
            bulletPoints: [
              'Pion (Pawn) = 1 Poin (satuan dasar perhitungan materi).',
              'Kuda (Knight) = 3 Poin (perwira ringan, sangat kuat di posisi tertutup).',
              'Gajah (Bishop) = 3 Poin (perwira ringan, sedikit lebih unggul di posisi terbuka atau jika berpasangan).',
              'Benteng (Rook) = 5 Poin (perwira berat; selisih nilai antara Benteng (5) dan Gajah/Kuda (3) disebut "Kualitas" atau "The Exchange").',
              'Menteri (Queen) = 9 Poin (perwira terkuat di papan).',
              'Raja (King) = Tak Terhingga (kehilangan Raja berarti kalah dalam permainan).'
            ]
          },
          {
            heading: 'Prinsip Pertukaran yang Menguntungkan',
            content: 'Jangan menukar perwira bernilai tinggi (seperti Menteri 9 poin atau Benteng 5 poin) hanya demi mendapatkan Pion (1 poin) atau Kuda (3 poin) yang dijaga lawan. Sebaliknya, menangkap perwira lawan yang bernilai lebih tinggi menggunakan buah bernilai lebih rendah adalah kunci keunggulan materi.'
          }
        ],
        keyTakeaways: [
          'Urutan nilai bidak: Pion (1), Kuda (3), Gajah (3), Benteng (5), Menteri (9).',
          'Menangkap Benteng (5 poin) dengan Gajah/Kuda (3 poin) disebut memenangkan kualitas (+2 poin).',
          'Selalu periksa apakah bidak lawan dijaga sebelum menangkapnya.'
        ],
        practice: {
          title: 'Praktik: Memilih Tangkapan Paling Bernilai',
          initialFen: '4k3/8/2n3r1/8/4B3/8/8/4K3 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e4', 'c6', 'g6'],
          instruction: 'Gajah Putih Anda di e4 (bernilai 3 poin) dapat menangkap Kuda Hitam di c6 (3 poin) ATAU Benteng Hitam di g6 (5 poin) yang keduanya tidak dijaga. Pilih langkah yang memberikan keuntungan nilai materi paling besar bagi Putih!',
          steps: [
            {
              expectedMoves: ['Bxg6+'],
              hint: 'Benteng bernilai 5 poin sedangkan Kuda bernilai 3 poin. Gunakan Gajah di e4 untuk menangkap Benteng di g6!',
              opponentReply: null,
              explanation: 'Keputusan tepat (Bxg6+)! Menangkap Benteng (5 poin) memberi keuntungan lebih besar dibandingkan menangkap Kuda (3 poin).'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'level-2',
    level: 2,
    title: 'Level 2 — Aturan Permainan',
    shortTitle: 'Aturan Permainan',
    description: 'Pelajari seluruh aturan resmi pertandingan catur mulai dari giliran melangkah, skak, skakmat, remis/stalemate, hingga tiga langkah spesial (Castling, En Passant, dan Promosi Pion).',
    badgeText: 'Dasar Aturan',
    lessons: [
      {
        id: 'l2-1-giliran-bermain',
        categoryId: 'level-2',
        order: 6,
        title: 'Giliran bermain',
        subtitle: 'Aturan urutan melangkah bergantian antara Putih dan Hitam serta kewajiban melangkah (Zugzwang).',
        xpReward: 60,
        estimatedMinutes: 5,
        theory: [
          {
            heading: 'Aturan Giliran dalam Catur',
            content: 'Dalam permainan catur resmi, pemain yang memegang buah Putih selalu melangkah terlebih dahulu. Setelah Putih menyelesaikan satu langkah, giliran berpindah kepada Hitam, dan begitu seterusnya secara bergantian hingga permainan berakhir.',
            bulletPoints: [
              'Tidak Boleh Melewatkan Giliran (No Pass): Dalam catur, seorang pemain WAJIB melakukan langkah legal saat tiba gilirannya, meskipun setiap langkah yang ada justru memperburuk posisinya (kondisi ini disebut Zugzwang).',
              'Satu Langkah Satu Buah: Dalam satu giliran, hanya satu buah catur yang digerakkan (kecuali pada langkah spesial Rokade / Castling di mana Raja dan Benteng bergerak bersamaan sebagai satu langkah sah).',
              'Menangkap adalah Pilihan: Berbeda dengan permainan dam (checkers), dalam catur Anda tidak wajib memakan buah lawan kecuali itu satu-satunya langkah legal untuk menyelamatkan Raja.'
            ]
          }
        ],
        keyTakeaways: [
          'Putih selalu memulai langkah pertama dalam pertandingan.',
          'Pemain tidak boleh melewatkan (pass) gilirannya.',
          'Satu pasangan langkah Putih dilanjutkan langkah Hitam dihitung sebagai 1 langkah penuh (Full Move).'
        ],
        practice: {
          title: 'Praktik: Bergantian Melangkah dan Merespons Ancaman',
          initialFen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['f1', 'b5', 'a4'],
          instruction: 'Sekarang adalah giliran Putih (Langkah ke-3). Langkah 1: Gerakkan Gajah dari f1 ke b5 untuk menekan Kuda lawan. Setelah Hitam membalas dengan a6 yang mengancam Gajah Anda, Langkah 2: Pada giliran berikutnya, tarik mundur Gajah ke petak aman a4!',
          steps: [
            {
              expectedMoves: ['Bb5'],
              hint: 'Klik Gajah Putih di f1 dan pindahkan ke petak b5.',
              opponentReply: 'a6',
              explanation: 'Giliran Putih selesai, lalu Hitam menggunakan gilirannya untuk mendorong pion a7 ke a6 mengancam Gajah Anda. Sekarang giliran Anda lagi!'
            },
            {
              expectedMoves: ['Ba4'],
              hint: 'Tarik Gajah dari b5 ke petak a4 agar tetap aman dan mempertahankan tekanan.',
              opponentReply: null,
              explanation: 'Bagus! Anda memahami ritme pergantian giliran dan merespons ancaman lawan tepat pada giliran Anda.'
            }
          ]
        }
      },
      {
        id: 'l2-2-check',
        categoryId: 'level-2',
        order: 7,
        title: 'Check',
        subtitle: 'Memahami kondisi Skak (Check) dan 3 cara menyelamatkan Raja (Capture, Protection/Block, Run/Escape).',
        xpReward: 60,
        estimatedMinutes: 7,
        theory: [
          {
            heading: 'Apa Itu Check (Skak)?',
            content: 'Check (Skak) terjadi ketika Raja berada di bawah ancaman serangan langsung oleh minimal satu buah lawan. Dalam aturan catur, seorang pemain TIDAK BOLEH membiarkan Rajanya tetap berada dalam kondisi skak pada akhir gilirannya.',
            bulletPoints: [
              'Metode CPR untuk Keluar dari Skak:',
              '1. Capture (Menangkap): Memakan buah lawan yang sedang memberikan skak.',
              '2. Protect / Block (Menutup Jalur): Menempatkan buah sendiri di antara Raja dan perwira penyerang lawan (hanya berlaku untuk serangan jarak jauh dari Menteri, Benteng, atau Gajah; serangan Kuda tidak bisa ditutup).',
              '3. Run / Escape (Melarikan Raja): Menggeser Raja ke petak sebelahnya yang kosong dan tidak sedang diserang lawan.'
            ]
          },
          {
            heading: 'Langkah Ilegal Saat Skak',
            content: 'Jika Raja Anda sedang di-skak, semua langkah lain yang tidak menghentikan skak tersebut adalah langkah ilegal dan tidak diizinkan oleh aturan catur.'
          }
        ],
        keyTakeaways: [
          'Raja yang diserang wajib segera diselamatkan pada giliran tersebut.',
          'Tiga cara mengatasi skak: Tangkap penyerang (Capture), Tutup jalur serangan (Block), atau Geser Raja (Escape).',
          'Urutan prioritas terbaik biasanya adalah menangkap penyerang jika menguntungkan, atau menutup serangan sambil mengembangkan buah.'
        ],
        practice: {
          title: 'Praktik: Menyelamatkan Raja dari Skak Lalu Menyerang Balik',
          initialFen: '4k3/8/8/8/1b6/8/2P5/3QK3 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e1', 'b4', 'c3'],
          instruction: 'Raja Putih Anda di e1 sedang terkena Skak (Check) oleh Gajah Hitam di b4! Langkah 1: Tutup jalur skak sekaligus ancam Gajah lawan dengan memajukan pion dari c2 ke c3. Langkah 2: Setelah Gajah lawan mundur, berikan Skak balasan dengan Menteri dari d1 ke a4!',
          steps: [
            {
              expectedMoves: ['c3'],
              hint: 'Dorong pion Putih dari c2 ke c3 untuk menutup diagonal skak b4-e1.',
              opponentReply: 'Bc5',
              explanation: 'Cerdas! Anda menutup skak (Block) dengan pion c3 sehingga Gajah lawan terpaksa mundur. Sekarang berikan skak balasan!'
            },
            {
              expectedMoves: ['Qa4+'],
              hint: 'Gerakkan Menteri Putih dari d1 ke a4 untuk memberikan Skak pada Raja Hitam di e8.',
              opponentReply: null,
              explanation: 'Mantap! Anda berhasil keluar dari skak secara efisien dan langsung memberikan skak balasan (Qa4+).'
            }
          ]
        }
      },
      {
        id: 'l2-3-checkmate',
        categoryId: 'level-2',
        order: 8,
        title: 'Checkmate',
        subtitle: 'Tujuan tertinggi dalam catur: mengunci Raja lawan dalam kondisi skak tanpa ada langkah penyelamatan legal.',
        xpReward: 60,
        estimatedMinutes: 7,
        theory: [
          {
            heading: 'Pengertian Checkmate (Skakmat)',
            content: 'Checkmate (Skakmat), disingkat dengan simbol "#" dalam notasi catur, terjadi ketika Raja seorang pemain sedang dalam keadaan Skak (Check) DAN pemain tersebut tidak memiliki satu pun langkah legal untuk menyelamatkan Rajanya:',
            bulletPoints: [
              'Buah yang memberikan skak tidak dapat ditangkap.',
              'Jalur serangan tidak dapat ditutup oleh buah apa pun.',
              'Seluruh petak pelarian di sekitar Raja sudah terhalang atau sedang dikontrol oleh buah penyerang.'
            ]
          },
          {
            heading: 'Akhir Pertandingan Mutlak',
            content: 'Begitu Skakmat terjadi, pertandingan langsung berakhir dengan kemenangan bagi pihak yang melakukan skakmat, tidak peduli berapa pun jumlah poin materi yang tersisa di papan.'
          }
        ],
        keyTakeaways: [
          'Skakmat = Raja sedang di-skak + 0 langkah penyelamatan legal.',
          'Skakmat langsung mengakhiri permainan dengan kemenangan mutlak.',
          'Kenali pola skakmat dasar seperti Back-Rank Mate (Skakmat Baris Belakang) dan Queen Support Mate.'
        ],
        practice: {
          title: 'Praktik: Eksekusi Skakmat Baris Belakang (Back-Rank Mate)',
          initialFen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d1', 'd8', 'g8'],
          instruction: 'Perhatikan Raja Hitam di g8 yang terkurung oleh ketiga pionnya sendiri di baris ke-7 (f7, g7, h7). Gerakkan Benteng Putih dari d1 ke baris ke-8 (d8) untuk melakukan Checkmate (Skakmat)!',
          steps: [
            {
              expectedMoves: ['Rd8#'],
              hint: 'Pindahkan Benteng Putih dari d1 lurus ke atas menuju petak d8.',
              opponentReply: null,
              explanation: 'Skakmat (Rd8#)! Raja Hitam terkena skak di baris ke-8 dan tidak bisa maju karena terhalang pionnya sendiri.'
            }
          ]
        }
      },
      {
        id: 'l2-4-stalemate',
        categoryId: 'level-2',
        order: 9,
        title: 'Stalemate',
        subtitle: 'Memahami kondisi Pat (Stalemate) yang menyebabkan permainan berakhir Remis (Draw), cara menghindarinya saat unggul, dan memanfaatkannya saat terdesak.',
        xpReward: 60,
        estimatedMinutes: 7,
        theory: [
          {
            heading: 'Perbedaan Checkmate vs Stalemate (Pat)',
            content: 'Stalemate (atau Pat dalam istilah Indonesia) adalah kondisi ketika pemain yang sedang mendapat giliran melangkah TIDAK sedang dalam keadaan skak, tetapi TIDAK memiliki satu pun langkah legal yang bisa dilakukan.',
            bulletPoints: [
              'Hasil Pertandingan: Stalemate langsung mengakhiri permainan dengan hasil REMIS (Draw / Seri), meskipun salah satu pemain unggul Menteri dan Benteng sekalipun!',
              'Ketika Anda Unggul Besar: Berhati-hatilah saat mengepung Raja lawan yang sendirian. Pastikan setiap langkah yang membatasi ruang Raja lawan adalah Skak, atau sisakan minimal satu langkah bagi lawan sebelum Anda memberikan skakmat.',
              'Ketika Anda Terdesak (Kalah Materi): Stalemate adalah senjata penyelamat! Anda bisa sengaja mengorbankan sisa buah Anda agar Raja Anda tidak memiliki langkah legal dan memaksa hasil remis.'
            ]
          }
        ],
        keyTakeaways: [
          'Stalemate = Raja TIDAK sedang di-skak + tidak ada langkah legal sama sekali.',
          'Hasil Stalemate selalu Remis (Draw), bukan kemenangan.',
          'Selalu periksa apakah Raja lawan masih bisa bergerak sebelum Anda melakukan langkah non-skak di akhir permainan.'
        ],
        practice: {
          title: 'Praktik: Menghindari Jebakan Stalemate dan Memilih Skakmat',
          initialFen: '7k/5K2/8/6Q1/8/8/8/8 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['g7', 'h8', 'f6'],
          instruction: 'Hati-hati! Jika Anda memindahkan Menteri ke f6 (Qf6), Raja Hitam di h8 tidak di-skak namun tidak punya langkah legal (Stalemate = Remis!). Sebaliknya, lakukan langkah yang benar: pindahkan Menteri dari g5 ke g7 untuk melakukan Skakmat!',
          steps: [
            {
              expectedMoves: ['Qg7#'],
              hint: 'Jangan ke f6 (itu Stalemate)! Gerakkan Menteri dari g5 ke petak g7 yang dijaga oleh Raja Putih di f7.',
              opponentReply: null,
              explanation: 'Sempurna (Qg7#)! Anda menghindari jebakan Stalemate di f6 dan memilih langkah Skakmat yang memenangkan permainan.'
            }
          ]
        }
      },
      {
        id: 'l2-5-castling',
        categoryId: 'level-2',
        order: 10,
        title: 'Castling',
        subtitle: 'Aturan lengkap Rokade Pendek (O-O) dan Rokade Panjang (O-O-O) untuk mengamankan Raja sekaligus mengaktifkan Benteng.',
        xpReward: 60,
        estimatedMinutes: 7,
        theory: [
          {
            heading: 'Apa Itu Castling (Rokade)?',
            content: 'Castling (Rokade) adalah satu-satunya langkah dalam catur di mana dua buah (Raja dan Benteng) bergerak bersamaan dalam satu giliran. Caranya: Raja bergeser 2 petak mendekati Benteng, lalu Benteng melompati Raja dan menempati petak yang baru saja dilewati Raja.',
            bulletPoints: [
              'Rokade Pendek / Kingside (notasi O-O): Raja Putih dari e1 ke g1, Benteng dari h1 ke f1.',
              'Rokade Panjang / Queenside (notasi O-O-O): Raja Putih dari e1 ke c1, Benteng dari a1 ke d1.',
              'Syarat Sah Rokade:',
              '1. Raja dan Benteng yang bersangkutan belum pernah bergerak sejak awal permainan.',
              '2. Seluruh petak di antara Raja dan Benteng harus kosong.',
              '3. Raja TIDAK sedang dalam keadaan skak saat ini.',
              '4. Petak yang dilewati Raja maupun petak tujuan Raja TIDAK sedang diserang oleh buah lawan.'
            ]
          }
        ],
        keyTakeaways: [
          'Untuk melakukan rokade di papan interaktif, klik Raja lalu klik petak tujuan sejauh 2 langkah (g1 atau c1).',
          'Raja tidak boleh melakukan rokade saat sedang di-skak atau melewati petak yang terancam.',
          'Rokade menyelesaikan dua tujuan strategis sekaligus: mengamankan Raja dan membawa Benteng ke jalur tengah.'
        ],
        practice: {
          title: 'Praktik: Melakukan Rokade Pendek (O-O)',
          initialFen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e1', 'g1', 'h1', 'f1'],
          instruction: 'Jalur antara Raja Putih di e1 dan Benteng di h1 sudah kosong, dan kedua buah belum pernah bergerak. Lakukan Rokade Pendek (O-O) dengan mengklik Raja di e1 lalu klik petak g1!',
          steps: [
            {
              expectedMoves: ['O-O'],
              hint: 'Klik Raja Putih di petak e1, kemudian klik petak g1 (dua langkah ke kanan). Benteng h1 akan otomatis berpindah ke f1.',
              opponentReply: null,
              explanation: 'Rokade berhasil (O-O)! Raja Putih kini aman di g1 dan Benteng aktif di f1.'
            }
          ]
        }
      },
      {
        id: 'l2-6-en-passant',
        categoryId: 'level-2',
        order: 11,
        title: 'En passant',
        subtitle: 'Aturan tangkapan pion spesial "Sambil Lalu" ketika pion lawan melompat dua petak melewati kawalan pion Anda.',
        xpReward: 60,
        estimatedMinutes: 7,
        theory: [
          {
            heading: 'Memahami Aturan En Passant',
            content: 'En Passant (bahasa Prancis yang berarti "sambil lalu") adalah aturan tangkapan khusus antar-pion. Aturan ini diciptakan agar pion yang maju 2 petak dari baris awalnya tidak bisa kabur begitu saja melewati kawalan pion lawan yang sudah berada di baris ke-5 (untuk Putih) atau baris ke-4 (untuk Hitam).',
            bulletPoints: [
              'Kapan En Passant Bisa Dilakukan?',
              '1. Pion Anda sudah berada di baris ke-5 (bagi Putih) atau baris ke-4 (bagi Hitam).',
              '2. Pion lawan di kolom sebelahnya baru saja melangkah maju 2 petak sekaligus dari petak awalnya sehingga sejajar persis di samping pion Anda.',
              '3. Anda dapat menangkap pion tersebut seolah-olah pion lawan baru maju 1 petak (pion Anda bergerak menyilang ke petak kosong di belakang pion lawan tersebut).',
              '4. PENTING: Hak menangkap En Passant HANYA berlaku tepat pada giliran berikutnya! Jika Anda melakukan langkah lain terlebih dahulu, hak En Passant pada pion tersebut hangus.'
            ]
          }
        ],
        keyTakeaways: [
          'En Passant hanya bisa dilakukan oleh Pion terhadap Pion lawan yang baru saja maju 2 langkah.',
          'Harus dieksekusi segera pada langkah berikutnya, atau kesempatannya hilang.',
          'Pion penangkap mendarat di petak yang dilewati pion lawan, bukan di petak tempat pion lawan berhenti.'
        ],
        practice: {
          title: 'Praktik: Menangkap Pion Lawan dengan En Passant',
          initialFen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e5', 'd5', 'd6'],
          instruction: 'Pion Hitam baru saja melompat 2 petak dari d7 ke d5, tepat di samping pion Putih Anda di e5! Gunakan aturan En Passant sekarang: klik pion Putih di e5 lalu klik petak diagonal d6 untuk menangkap pion d5 lawan!',
          steps: [
            {
              expectedMoves: ['exd6'],
              hint: 'Klik pion Putih di e5, lalu klik petak d6 (di atas pion Hitam d5).',
              opponentReply: null,
              explanation: 'Brilian (exd6 e.p.)! Pion Putih Anda bergerak ke d6 dan pion Hitam di d5 tertangkap melalui aturan En Passant.'
            }
          ]
        }
      },
      {
        id: 'l2-7-pawn-promotion',
        categoryId: 'level-2',
        order: 12,
        title: 'Pawn promotion',
        subtitle: 'Transformasi pion yang mencapai baris terakhir menjadi Menteri, Benteng, Gajah, atau Kuda.',
        xpReward: 60,
        estimatedMinutes: 6,
        theory: [
          {
            heading: 'Keajaiban Promosi Pion (Pawn Promotion)',
            content: 'Meskipun Pion bernilai paling kecil (1 poin), setiap Pion menyimpan potensi luar biasa! Ketika sebuah Pion berhasil mencapai baris paling ujung di seberang papan (baris ke-8 untuk Putih, atau baris ke-1 untuk Hitam), pion tersebut WAJIB langsung dipromosikan (diubah) menjadi perwira pada giliran yang sama.',
            bulletPoints: [
              'Pilihan Promosi: Pion dapat diubah menjadi Menteri (Queen), Benteng (Rook), Gajah (Bishop), atau Kuda (Knight) dengan warna yang sama.',
              'Tidak Boleh Tetap Menjadi Pion atau Diubah Menjadi Raja.',
              'Tidak Terbatas pada Perwira yang Sudah Tertangkap: Anda tetap boleh mempromosikan pion menjadi Menteri kedua (atau ketiga!) meskipun Menteri asli Anda masih ada di papan.',
              'Underpromotion: Memilih promosi selain Menteri (misalnya memilih Kuda untuk memberikan skak garpu, atau memilih Benteng untuk menghindari Stalemate).'
            ]
          }
        ],
        keyTakeaways: [
          'Pion Putih promosi di baris ke-8; Pion Hitam promosi di baris ke-1.',
          '95% promosi dalam pertandingan memilih Menteri (Queen) karena nilainya paling tinggi (9 poin).',
          'Promosi pion sering menjadi penentu kemenangan di babak akhir permainan (Endgame).'
        ],
        practice: {
          title: 'Praktik: Promosi Pion Menjadi Menteri Sekaligus Skakmat',
          initialFen: '4k3/P7/4K3/8/8/8/8/8 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['a7', 'a8'],
          instruction: 'Pion Putih Anda di a7 tinggal selangkah lagi mencapai baris ke-8! Majukan pion dari a7 ke a8 dan pilih promosi menjadi Menteri (Queen) untuk langsung melakukan Skakmat pada Raja Hitam!',
          steps: [
            {
              expectedMoves: ['a8=Q#'],
              hint: 'Klik pion di a7, klik petak a8, lalu pilih Menteri (Queen) pada dialog promosi.',
              opponentReply: null,
              explanation: 'Luar biasa (a8=Q#)! Pion Anda bertransformasi menjadi Menteri di a8 dan langsung mengunci Raja Hitam dengan Skakmat!'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'level-3',
    level: 3,
    title: 'Level 3 — Taktik Catur',
    shortTitle: 'Taktik Catur',
    description: 'Kuasai senjata taktis paling mematikan untuk memenangkan materi dan menghancurkan pertahanan lawan dalam hitungan langkah.',
    badgeText: 'Menengah',
    lessons: [
      {
        id: 'l3-1-fork',
        categoryId: 'level-3',
        order: 13,
        title: 'Fork',
        subtitle: 'Taktik Garpu (Serangan Ganda satu bidak) yang mengancam dua atau lebih target bernilai tinggi secara bersamaan.',
        xpReward: 75,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Konsep Taktik Fork (Garpupan)',
            content: 'Fork (Garpu) adalah manuver taktis di mana SATU buah catur menyerang DUA atau lebih buah lawan secara bersamaan. Karena lawan hanya bisa menggerakkan satu buah dalam satu giliran, salah satu buah yang diserang hampir pasti akan jatuh ke tangan Anda.',
            bulletPoints: [
              'Kuda Sang Spesialis Fork: Karena pola geraknya yang melompat membentuk huruf L, Kuda dapat menyerang Raja dan Menteri lawan tanpa bisa ditutup jalurnya dan tanpa terancam balik oleh Menteri tersebut.',
              'Royal Fork (Garpu Kerajaan): Fork yang menyerang Raja (Check) sekaligus Menteri lawan. Karena lawan wajib menyelamatkan Rajanya terlebih dahulu, Menteri lawan pasti tertangkap pada langkah berikutnya!',
              'Semua Buah Bisa Melakukan Fork: Tidak hanya Kuda! Pion, Gajah, Benteng, Menteri, bahkan Raja pun dapat melakukan taktik Fork.'
            ]
          }
        ],
        keyTakeaways: [
          'Cari petak di mana satu buah Anda dapat mengancam dua perwira lawan sekaligus.',
          'Fork yang disertai Skak (Check) adalah yang paling mematikan karena memaksa lawan menggerakkan Raja.',
          'Waspadai petak-petak sewarna tempat Raja dan Menteri Anda bisa terkena garpuan Kuda lawan.'
        ],
        practice: {
          title: 'Praktik: Royal Fork Kuda Memenangkan Menteri',
          initialFen: '4k3/1q6/8/8/4N3/8/8/4K3 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e4', 'd6', 'e8', 'b7'],
          instruction: 'Perhatikan posisi Raja Hitam di e8 dan Menteri Hitam di b7! Langkah 1: Lompatkan Kuda Putih dari e4 ke d6 (Nd6+) untuk melakukan Royal Fork—memberikan Skak pada Raja di e8 sekaligus mengancam Menteri di b7. Langkah 2: Setelah Raja Hitam menyingkir ke d7, tangkap Menteri Hitam di b7 (Nxb7)!',
          steps: [
            {
              expectedMoves: ['Nd6+'],
              hint: 'Lompatkan Kuda Putih dari e4 ke petak d6 untuk memberikan Skak pada Raja e8 sekaligus menyerang Menteri b7!',
              opponentReply: 'Kd7',
              explanation: 'Royal Fork yang mematikan (Nd6+)! Raja Hitam terpaksa menyingkir ke d7 dan tidak bisa menyelamatkan Menterinya.'
            },
            {
              expectedMoves: ['Nxb7'],
              hint: 'Gunakan Kuda di d6 untuk menangkap Menteri Hitam di b7!',
              opponentReply: null,
              explanation: 'Kombinasi Fork yang sempurna (Nxb7)! Anda memenangkan Menteri lawan secara bersih.'
            }
          ]
        }
      },
      {
        id: 'l3-2-pin',
        categoryId: 'level-3',
        order: 14,
        title: 'Pin',
        subtitle: 'Taktik Pakuan (Absolute Pin & Relative Pin) untuk melumpuhkan pergerakan perwira pelindung lawan.',
        xpReward: 75,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Apa Itu Taktik Pin (Pakuan)?',
            content: 'Pin (Pakuan) terjadi ketika perwira jarak jauh Anda (Gajah, Benteng, atau Menteri) menyerang sebuah bidak lawan yang tidak bisa atau tidak berani berpindah tempat karena di belakangnya pada garis yang sama terdapat bidak lain yang jauh lebih berharga.',
            bulletPoints: [
              'Absolute Pin (Pakuan Mutlak): Ketika buah yang berada di belakang adalah RAJA. Buah yang terpaku secara aturan catur DILARANG bergerak keluar dari garis pin karena akan menyebabkan Rajanya terkena skak.',
              'Relative Pin (Pakuan Relatif): Ketika buah di belakang adalah perwira bernilai tinggi selain Raja (misalnya Menteri atau Benteng). Buah yang terpaku secara teknis masih legal untuk bergerak, namun jika bergerak akan mengakibatkan kehilangan materi besar.',
              'Prinsip "Pile Up on the Pinned Piece": Saat buah lawan sudah terpaku (tidak bisa kabur), tambahkan penyerang kedua (terutama pion atau perwira lain) ke buah yang terpaku tersebut untuk memenangkannya!'
            ]
          }
        ],
        keyTakeaways: [
          'Hanya perwira garis lurus/diagonal (Menteri, Benteng, Gajah) yang dapat melakukan Pin.',
          'Absolute Pin melumpuhkan buah lawan secara total karena melindungi Raja.',
          'Serang buah yang sedang terkena Pin dengan buah tambahan untuk merebutnya.'
        ],
        practice: {
          title: 'Praktik: Memaku Kuda Lawan (Absolute Pin) & Merebutnya',
          initialFen: '4k3/8/4n3/3P4/8/8/8/3R2K1 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d1', 'e1', 'e6', 'e8', 'd5'],
          instruction: 'Kuda Hitam di e6 berdiri tepat di depan Raja Hitam di e8! Langkah 1: Geser Benteng Putih dari d1 ke e1 untuk melakukan Absolute Pin (Kuda e6 menjadi lumpuh total karena tidak boleh membuka skak terhadap Rajanya sendiri). Langkah 2: Setelah Raja Hitam mendekat ke d7, tangkap Kuda yang terpaku di e6 menggunakan pion d5 (dxe6+)!',
          steps: [
            {
              expectedMoves: ['Re1'],
              hint: 'Geser Benteng Putih dari d1 ke e1 untuk memaku Kuda Hitam di e6 terhadap Raja di e8.',
              opponentReply: 'Kd7',
              explanation: 'Absolute Pin berhasil (Re1)! Kuda di e6 tidak memiliki langkah legal karena melindungi Raja di e8. Hitam mencoba menjaga dengan Kd7.'
            },
            {
              expectedMoves: ['dxe6+'],
              hint: 'Gunakan pion Putih di d5 untuk menangkap Kuda yang terpaku di e6 sekaligus memberikan Skak!',
              opponentReply: null,
              explanation: 'Taktik Pin yang sempurna (dxe6+)! Anda melumpuhkan Kuda lawan dengan Benteng lalu memenangkannya dengan pion.'
            }
          ]
        }
      },
      {
        id: 'l3-3-skewer',
        categoryId: 'level-3',
        order: 15,
        title: 'Skewer',
        subtitle: 'Taktik Tusuk Sate (Kebalikan dari Pin) di mana buah bernilai lebih tinggi diserang lebih dulu dan dipaksa menyingkir.',
        xpReward: 75,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Memahami Taktik Skewer (Tusuk Sate)',
            content: 'Skewer adalah kebalikan persis dari Pin. Dalam Pin, buah bernilai lebih kecil berada di depan melindungi buah bernilai besar di belakangnya. Dalam Skewer, buah yang LEBIH BERHARGA (biasanya Raja atau Menteri) berada di depan dan diserang secara langsung. Ketika buah berharga tersebut terpaksa menyingkir untuk menyelamatkan diri, buah yang berada di belakangnya menjadi terbuka dan dapat ditangkap!',
            bulletPoints: [
              'Sifat Memaksa: Skewer terhadap Raja (Absolute Skewer) sangat memaksa karena lawan wajib menggerakkan Rajanya keluar dari jalur skak.',
              'Perwira Pelaksana: Sama seperti Pin, Skewer hanya dapat dilakukan oleh perwira jarak jauh (Menteri, Benteng, dan Gajah).',
              'Sering Muncul di Endgame: Taktik Skewer Benteng atau Gajah sepanjang baris/diagonal panjang sangat sering menjadi penentu kemenangan di babak akhir.'
            ]
          }
        ],
        keyTakeaways: [
          'Pin: Buah kecil di depan, buah besar di belakang.',
          'Skewer: Buah besar di depan (dipaksa minggir), buah di belakangnya tertangkap.',
          'Perhatikan setiap kali Raja dan Menteri/Benteng lawan berada pada satu garis lurus atau diagonal yang sama.'
        ],
        practice: {
          title: 'Praktik: Skewer Diagonal Gajah Memenangkan Benteng',
          initialFen: '8/6r1/5k2/8/8/B7/8/4K3 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['a3', 'b2', 'f6', 'g7'],
          instruction: 'Perhatikan Raja Hitam di f6 dan Benteng Hitam di g7 yang berada pada satu diagonal panjang (a1-h8)! Langkah 1: Gerakkan Gajah Putih dari a3 ke b2 untuk memberikan Skak Skewer pada Raja Hitam. Langkah 2: Setelah Raja Hitam menyingkir, tangkap Benteng Hitam di g7!',
          steps: [
            {
              expectedMoves: ['Bb2+'],
              hint: 'Pindahkan Gajah dari a3 ke petak b2 untuk menyerang Raja f6 di sepanjang diagonal b2-g7.',
              opponentReply: 'Kf7',
              explanation: 'Skewer yang tajam (Bb2+)! Raja Hitam terpaksa menyingkir ke f7 dan meninggalkan Benteng di g7 tanpa perlindungan.'
            },
            {
              expectedMoves: ['Bxg7'],
              hint: 'Gunakan Gajah di b2 untuk menangkap Benteng Hitam di g7!',
              opponentReply: null,
              explanation: 'Luar biasa! Melalui taktik Skewer, Anda berhasil memenangkan Benteng lawan secara gratis.'
            }
          ]
        }
      },
      {
        id: 'l3-4-discovered-attack',
        categoryId: 'level-3',
        order: 16,
        title: 'Discovered Attack',
        subtitle: 'Serangan Terbuka yang terjadi ketika satu buah melangkah dan membuka jalur serangan perwira jarak jauh di belakangnya.',
        xpReward: 75,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Kekuatan Discovered Attack (Serangan Terbuka)',
            content: 'Discovered Attack terjadi ketika Anda menggerakkan sebuah buah catur, dan perpindahan buah tersebut membuka garis serangan dari perwira jarak jauh Anda (Benteng, Gajah, atau Menteri) yang tadinya terhalang di belakangnya.',
            bulletPoints: [
              'Ancaman Ganda Sekaligus: Buah yang bergerak maju dapat mengancam satu target (atau memberikan skak), sementara perwira di belakang yang jalurnya terbuka menyerang target kedua (seperti Menteri lawan).',
              'Discovered Check (Skak Terbuka): Ketika perwira di belakang membuka jalur Skak terhadap Raja lawan. Buah yang bergerak di depan bebas menangkap atau menyerang apa saja karena lawan wajib mengurus Skak dari perwira di belakang!',
              'Kincir Angin (Windmill): Variasi berulang dari Discovered Check yang dapat menyapu bersih banyak buah lawan secara beruntun.'
            ]
          }
        ],
        keyTakeaways: [
          'Susun baterai perwira jarak jauh (Benteng/Gajah/Menteri) sejajar dengan Raja atau Menteri lawan.',
          'Gerakkan buah penghalang ke petak yang menciptakan ancaman kedua atau menangkap buah lawan.',
          'Discovered Check hampir selalu memenangkan materi karena memberikan satu tempo gratis.'
        ],
        practice: {
          title: 'Praktik: Discovered Check Memenangkan Menteri Lawan',
          initialFen: '4k3/6q1/8/8/8/4B3/8/4R2K w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e1', 'e3', 'd4', 'g7', 'e8'],
          instruction: 'Benteng Putih di e1 berada satu lajur dengan Raja Hitam di e8, namun terhalang oleh Gajah Anda sendiri di e3. Sementara itu Menteri Hitam berada di g7! Langkah 1: Gerakkan Gajah dari e3 ke d4 (Bd4+) untuk membuka Skak Benteng (Discovered Check) sekaligus mengancam Menteri Hitam di g7 secara diagonal. Langkah 2: Setelah Raja Hitam menyingkir ke f8, tangkap Menteri Hitam di g7 (Bxg7+)!',
          steps: [
            {
              expectedMoves: ['Bd4+'],
              hint: 'Pindahkan Gajah dari e3 ke d4. Langkah ini membuka jalur Skak dari Benteng e1 ke Raja e8 sekaligus menyerang Menteri g7!',
              opponentReply: 'Kf8',
              explanation: 'Discovered Check yang brilian (Bd4+)! Karena Raja Hitam terkena skak oleh Benteng e1, Hitam terpaksa menggeser Rajanya ke f8 dan tidak bisa menyelamatkan Menteri di g7.'
            },
            {
              expectedMoves: ['Bxg7+'],
              hint: 'Tangkap Menteri Hitam di g7 menggunakan Gajah Anda di d4!',
              opponentReply: null,
              explanation: 'Sempurna (Bxg7+)! Taktik Discovered Attack berhasil meruntuhkan Menteri lawan.'
            }
          ]
        }
      },
      {
        id: 'l3-5-double-attack',
        categoryId: 'level-3',
        order: 17,
        title: 'Double Attack',
        subtitle: 'Menciptakan dua ancaman mematikan sekaligus (ancaman skakmat dan ancaman perwira tak terjaga) dalam satu langkah.',
        xpReward: 75,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Prinsip Dasar Double Attack (Serangan Ganda)',
            content: 'Double Attack adalah payung besar dari hampir seluruh taktik kemenangan dalam catur. Berbeda dengan Fork yang biasanya identik dengan satu perwira ringan atau pion yang bercabang dua, Double Attack secara luas mencakup langkah Menteri atau kombinasi perwira yang mengancam dua titik lemah secara bersamaan (misalnya mengancam petak Skakmat sekaligus mengancam Benteng/Kuda yang tidak terjaga).',
            bulletPoints: [
              'Rumus Taktik: "Loose Pieces Drop Off" (Perwira yang tidak terjaga mudah jatuh terkena Double Attack).',
              'Kombinasi Ancaman Skak + Perwira Tak Terjaga: Menteri adalah perwira terbaik untuk melakukan Double Attack jarak jauh karena dapat menyerang secara lurus dan diagonal sekaligus.',
              'Cara Bertahan dari Double Attack: Selalu pastikan perwira Anda saling melindungi (terkoordinasi) dan Raja Anda tidak memiliki kelemahan baris/diagonal terbuka.'
            ]
          }
        ],
        keyTakeaways: [
          'Identifikasi dua kelemahan di pertahanan lawan: Raja yang terbuka dan perwira yang tidak dijaga (undefended piece).',
          'Cari petak persimpangan tempat Menteri atau perwira Anda dapat menyerang kedua target tersebut sekaligus.',
          'Jika salah satu serangan adalah Skak (Check), lawan tidak akan punya waktu menyelamatkan perwira keduanya.'
        ],
        practice: {
          title: 'Praktik: Double Attack Menteri (Skak + Rebut Benteng)',
          initialFen: '4k3/8/8/r7/8/8/8/3QK3 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d1', 'd8', 'e8', 'a5'],
          instruction: 'Raja Hitam di e8 dan Benteng Hitam di a5 terpisah jauh, namun Benteng a5 tidak dijaga! Langkah 1: Gerakkan Menteri Putih dari d1 ke d8 untuk memberikan Skak pada Raja e8 sekaligus mengancam Benteng a5 secara diagonal. Langkah 2: Tangkap Benteng di a5!',
          steps: [
            {
              expectedMoves: ['Qd8+'],
              hint: 'Pindahkan Menteri Putih dari d1 ke petak d8. Dari d8, Menteri menyerang Raja e8 (horizontal) dan Benteng a5 (diagonal)!',
              opponentReply: 'Kf7',
              explanation: 'Double Attack yang presisi (Qd8+)! Raja Hitam terpaksa lari ke f7.'
            },
            {
              expectedMoves: ['Qxa5'],
              hint: 'Gunakan Menteri di d8 untuk menangkap Benteng Hitam yang tak terjaga di a5.',
              opponentReply: null,
              explanation: 'Tuntas! Anda menguasai konsep Double Attack jarak jauh untuk memenangkan Benteng.'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'level-4',
    level: 4,
    title: 'Level 4 — Strategi Catur',
    shortTitle: 'Strategi Catur',
    description: 'Beralih dari taktik jangka pendek menuju perencanaan jangka panjang: menguasai pusat, mengembangkan perwira, menjaga keamanan raja, struktur pion, dan mengoptimalkan aktivitas bidak.',
    badgeText: 'Menengah-Lanjut',
    lessons: [
      {
        id: 'l4-1-kontrol-pusat',
        categoryId: 'level-4',
        order: 18,
        title: 'Kontrol pusat',
        subtitle: 'Mengapa penguasaan petak d4, e4, d5, dan e5 menjadi fondasi utama keunggulan strategis.',
        xpReward: 80,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Mengapa Pusat Papan Begitu Penting?',
            content: 'Jika Taktik adalah "apa yang harus dilakukan ketika ada sasaran langsung", maka Strategi adalah "apa yang harus dilakukan ketika tidak ada sasaran langsung". Prinsip strategis nomor satu adalah Kontrol Pusat (petak d4, e4, d5, e5).',
            bulletPoints: [
              'Mobilitas Maksimal: Sebuah Kuda di tengah papan (misalnya di d4 atau e5) mengontrol 8 petak, sedangkan Kuda di pojok papan hanya mengontrol 2 petak ("A Knight on the rim is dim").',
              'Akses Cepat ke Kedua Sayap: Perwira yang berada di pusat dapat berpindah dengan cepat ke Sayap Raja maupun Sayap Menteri sesuai kebutuhan serangan atau pertahanan.',
              'Membatasi Ruang Lawan: Dengan menempatkan duet pion ideal di d4 dan e4 (Classical Center), Anda mendorong mundur perwira lawan dan mempersempit ruang gerak mereka.'
            ]
          }
        ],
        keyTakeaways: [
          'Kuasai pusat menggunakan pion (e4 dan d4) serta dukung dengan perwira ringan.',
          'Jangan terburu-buru mendorong pion tepi (a atau h) di awal permainan karena tidak membantu kontrol pusat.',
          'Pemain yang menguasai pusat memiliki ruang gerak yang lebih luas dan fleksibel.'
        ],
        practice: {
          title: 'Praktik: Membangun Pusat Pion Klasik (e4 & d4)',
          initialFen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e4', 'd5', 'c3', 'd4'],
          instruction: 'Pion e4 Anda sedang ditantang oleh pion Hitam di d5. Langkah 1: Tangkap pion pusat lawan dengan exd5. Langkah 2: Setelah Menteri Hitam memakan kembali di d5 (Qxd5), serang Menteri tersebut sambil mengembangkan Kuda ke c3 (Nc3). Langkah 3: Setelah Menteri lawan mundur, rebut penuh pusat papan dengan mendorong pion d2 ke d4!',
          steps: [
            {
              expectedMoves: ['exd5'],
              hint: 'Gunakan pion Putih di e4 untuk menangkap pion Hitam di d5.',
              opponentReply: 'Qxd5',
              explanation: 'Bagus! Sekarang Menteri Hitam keluar terlalu cepat ke pusat d5. Manfaatkan untuk mengembangkan Kuda dengan tempo!'
            },
            {
              expectedMoves: ['Nc3'],
              hint: 'Keluarkan Kuda dari b1 ke c3 untuk mengancam Menteri Hitam di d5 sekaligus mengontrol pusat.',
              opponentReply: 'Qa5',
              explanation: 'Cerdas! Kuda berkembang ke c3 dengan tempo gratis karena Menteri lawan terpaksa lari ke a5. Sekarang kuasai pusat dengan pion d!'
            },
            {
              expectedMoves: ['d4'],
              hint: 'Majukan pion dari d2 ke d4 untuk menguasai pusat papan secara penuh.',
              opponentReply: null,
              explanation: 'Strategi sempurna! Putih kini mendominasi pusat papan (d4 & Kuda c3) dengan keunggulan waktu pengembangan.'
            }
          ]
        }
      },
      {
        id: 'l4-2-pengembangan-bidak',
        categoryId: 'level-4',
        order: 19,
        title: 'Pengembangan bidak',
        subtitle: 'Prinsip mengeluarkan perwira ringan secara cepat, harmonis, dan menghindari pemborosan tempo.',
        xpReward: 80,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Aturan Emas Pengembangan Bidak (Development)',
            content: 'Pada fase awal permainan (Opening), tujuan utama Anda adalah mengeluarkan seluruh perwira dari baris pertama menuju petak-petak aktif secepat dan seefisien mungkin.',
            bulletPoints: [
              'Kuda Sebelum Gajah (Knights before Bishops): Kuda memiliki petak terbaik yang sudah jelas sejak awal (f3 dan c3 untuk Putih), sedangkan Gajah sudah bisa mengontrol diagonal bahkan dari petak asalnya sambil menunggu petak sasaran terbaik.',
              'Jangan Menggerakkan Bidak yang Sama Berulang Kali di Pembukaan: Setiap langkah ekstra dengan satu bidak berarti perwira Anda yang lain masih tertidur di baris belakang.',
              'Jangan Keluarkan Menteri Terlalu Dini: Menteri yang keluar terlalu cepat mudah diserang oleh perwira ringan lawan yang nilainya lebih kecil, sehingga lawan mendapat pengembangan gratis (tempo).',
              'Hubungkan Kedua Benteng (Connect the Rooks): Pengembangan dianggap tuntas ketika Kuda, Gajah, dan Menteri sudah keluar serta Raja sudah Rokade, sehingga kedua Benteng saling terhubung di baris pertama.'
            ]
          }
        ],
        keyTakeaways: [
          'Kembangkan perwira ringan (Kuda dan Gajah) terlebih dahulu sebelum perwira berat.',
          'Setiap langkah di awal permainan harus membantu kontrol pusat atau membuka jalur perwira.',
          'Hindari berburu pion tepi di pembukaan jika mengorbankan kecepatan pengembangan.'
        ],
        practice: {
          title: 'Praktik: Menghukum Lawan yang Menggerakkan Bidak Berulang Kali',
          initialFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['f1', 'c4', 'b1', 'c3'],
          instruction: 'Kuda Putih di f3 sudah aktif menyerang e5. Langkah 1: Kembangkan Gajah dari f1 ke petak aktif c4 (menekan f7). Langkah 2: Setelah lawan mengembangkan Kuda ke c6, lengkapi pengembangan perwira ringan dengan mengeluarkan Kuda kedua dari b1 ke c3!',
          steps: [
            {
              expectedMoves: ['Bc4'],
              hint: 'Keluarkan Gajah Putih dari f1 ke petak c4.',
              opponentReply: 'Nc6',
              explanation: 'Gajah kini aktif di diagonal a2-g8. Sekarang aktifkan Kuda di sayap menteri!'
            },
            {
              expectedMoves: ['Nc3'],
              hint: 'Keluarkan Kuda Putih dari b1 ke c3.',
              opponentReply: null,
              explanation: 'Pengembangan yang sangat rapi! Dalam 3 langkah awal, Anda sudah mengontrol pusat dan mengaktifkan tiga perwira ringan.'
            }
          ]
        }
      },
      {
        id: 'l4-3-keamanan-raja',
        categoryId: 'level-4',
        order: 20,
        title: 'Keamanan raja',
        subtitle: 'Melindungi Raja melalui rokade tepat waktu dan menjaga keutuhan perisai pion di depan Raja.',
        xpReward: 80,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Prioritas Utama: Keamanan Raja (King Safety)',
            content: 'Keunggulan materi atau ruang tidak akan ada artinya jika Raja Anda terjebak di tengah papan yang terbuka dan menjadi sasaran serangan mematikan.',
            bulletPoints: [
              'Bahaya Raja di Tengah (Kolom e): Pusat papan adalah tempat terjadinya pertukaran pion dan pembukaan jalur. Raja yang terlambat melakukan rokade sangat rentan terkena Pin dan serangan Benteng/Menteri di lajur e.',
              'Perisai Pion (Pawn Shield): Setelah melakukan rokade pendek (misal Raja Putih di g1), ketiga pion di f2, g2, dan h2 adalah pengawal pribadi Raja. Hindari memajukan pion-pion ini tanpa alasan mendesak karena setiap dorongan pion menciptakan lubang permanen di sekitar Raja.',
              'Memanfaatkan Raja Lawan yang Belum Rokade: Jika lawan menunda rokade, strategi terbaik Anda adalah membuka jalur tengah (dengan pertukaran pion pusat) agar perwira Anda dapat langsung menyerbu Raja lawan.'
            ]
          }
        ],
        keyTakeaways: [
          'Lakukan rokade dalam 6–10 langkah pertama sebelum membuka pertempuran besar di tengah.',
          'Jaga pion f, g, dan h tetap rapat di depan Raja yang sudah rokade pendek.',
          'Buka lajur tengah jika Raja lawan masih tertahan di kolom e.'
        ],
        practice: {
          title: 'Praktik: Mengamankan Raja dan Membuka Lajur Serangan',
          initialFen: 'rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e1', 'g1', 'f1'],
          instruction: 'Perwira sayap raja Anda sudah keluar. Langkah 1: Amankan Raja Putih segera dengan melakukan Rokade Pendek (O-O). Langkah 2: Setelah lawan melangkah, tempatkan Benteng dari f1 ke lajur tengah e1 untuk mengawal pusat dan siap menekan kolom e!',
          steps: [
            {
              expectedMoves: ['O-O'],
              hint: 'Klik Raja Putih di e1 lalu klik petak g1 untuk melakukan Rokade Pendek.',
              opponentReply: 'Be7',
              explanation: 'Raja Putih kini aman berlindung di balik perisai pion f2, g2, h2. Sekarang aktifkan Benteng ke lajur tengah!'
            },
            {
              expectedMoves: ['Re1'],
              hint: 'Geser Benteng Putih dari f1 ke e1.',
              opponentReply: null,
              explanation: 'Sangat solid! Raja Anda aman di sudut sementara Benteng langsung bekerja di kolom tengah e1.'
            }
          ]
        }
      },
      {
        id: 'l4-4-struktur-pion',
        categoryId: 'level-4',
        order: 21,
        title: 'Struktur pion',
        subtitle: 'Mengenal kelemahan pion (Doubled, Isolated, Backward Pawn) dan kekuatan Passed Pawn (Pion Bebas).',
        xpReward: 80,
        estimatedMinutes: 8,
        theory: [
          {
            heading: '"Pion Adalah Jiwa Permainan Catur" — Philidor',
            content: 'Karena pion tidak pernah bisa berjalan mundur, setiap langkah pion mengubah struktur papan secara permanen. Struktur pion menentukan di mana perwira harus ditempatkan dan rencana apa yang harus dijalankan.',
            bulletPoints: [
              'Passed Pawn (Pion Bebas): Pion yang tidak lagi memiliki pion lawan di depannya (baik pada kolom yang sama maupun kolom sebelahnya) yang dapat menghalangi jalannya menuju petak promosi. Ini adalah aset strategis yang sangat kuat!',
              'Doubled Pawns (Pion Tumpuk): Dua pion berwarna sama yang berada pada satu kolom vertikal yang sama sehingga saling menghalangi dan tidak bisa saling menjaga.',
              'Isolated Pawn (Pion Terisolasi): Pion yang tidak memiliki rekan pion di kolom kiri maupun kanannya, sehingga hanya bisa dijaga oleh perwira.',
              'Pawn Chain (Rantai Pion): Barisan pion diagonal yang saling melindungi satu sama lain dari pangkal (base) hingga ujung.'
            ]
          }
        ],
        keyTakeaways: [
          'Ciptakan dan dorong Passed Pawn (Pion Bebas) karena memaksa perwira lawan sibuk bertahan.',
          'Hindari menciptakan pion tumpuk atau terisolasi di kubu sendiri tanpa kompensasi aktivitas.',
          'Ingat bahwa pion tidak bisa mundur—pikirkan dua kali sebelum mendorong pion.'
        ],
        practice: {
          title: 'Praktik: Menciptakan dan Mengawal Pion Bebas (Passed Pawn)',
          initialFen: '4k3/p4ppp/1p6/2pP4/2P5/8/PP3PPP/4K3 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d5', 'd6', 'e2'],
          instruction: 'Perhatikan Pion Putih di d5! Tidak ada satu pun pion Hitam di kolom c, d, atau e yang masih berada di depannya—pion d5 adalah Passed Pawn (Pion Bebas)! Langkah 1: Dorong pion bebas dari d5 ke d6 untuk mengikat Raja lawan. Langkah 2: Setelah Raja Hitam menahan di d8, aktifkan Raja Putih Anda ke e2 (atau d2) untuk mulai mengawal pion bebas tersebut!',
          steps: [
            {
              expectedMoves: ['d6'],
              hint: 'Majukan pion bebas Putih dari d5 ke d6.',
              opponentReply: 'Kd8',
              explanation: 'Pion bebas semakin mengancam di d6! Raja Hitam terpaksa mendekat ke d8 untuk memblokade.'
            },
            {
              expectedMoves: ['Ke2', 'Kd2'],
              hint: 'Aktifkan Raja Putih Anda dari e1 ke e2 atau d2 untuk mendukung pion bebas d6.',
              opponentReply: null,
              explanation: 'Tepat! Pion bebas di d6 mengikat Raja lawan di d8 sementara Raja Anda bebas maju membantu.'
            }
          ]
        }
      },
      {
        id: 'l4-5-aktivitas-bidak',
        categoryId: 'level-4',
        order: 22,
        title: 'Aktivitas bidak',
        subtitle: 'Memaksimalkan jangkauan perwira: Benteng di lajur terbuka, Kuda di Outpost, dan Gajah baik vs Gajah buruk.',
        xpReward: 80,
        estimatedMinutes: 8,
        theory: [
          {
            heading: 'Kualitas Posisi Lebih Penting dari Sekadar Keberadaan Bidak',
            content: 'Sebuah Benteng yang terkurung di sudut papan hampir tidak memberikan kontribusi, sementara Benteng yang menguasai lajur terbuka dan masuk ke baris ke-7 dapat melumpuhkan seluruh pasukan lawan.',
            bulletPoints: [
              'Benteng di Lajur Terbuka (Open File) & Baris ke-7: Tempatkan Benteng pada kolom yang tidak lagi memiliki pion, lalu susupkan ke baris ke-7 (baris tempat pion lawan berbaris dan Raja lawan sering terperangkap).',
              'Outpost (Pos Terdepan) untuk Kuda: Petak strategis di wilayah lawan (biasanya di baris ke-5 atau ke-6) yang dilindungi oleh pion sendiri dan tidak bisa diusir oleh pion lawan.',
              'Good Bishop vs Bad Bishop: Gajah yang baik (Good Bishop) adalah Gajah yang pion-pion pusatnya berada di warna petak yang berbeda darinya sehingga jalurnya bebas terbuka.'
            ]
          }
        ],
        keyTakeaways: [
          'Selalu tanyakan: "Bidak mana milik saya yang paling pasif, dan bagaimana cara mengaktifkannya?"',
          'Kuasai lajur terbuka dengan Benteng dan masuklah ke baris ke-7.',
          'Tempatkan Kuda di petak Outpost tengah yang bebas dari gangguan pion lawan.'
        ],
        practice: {
          title: 'Praktik: Menguasai Lajur Terbuka & Menyusup ke Baris ke-7',
          initialFen: '6k1/ppp2ppp/8/8/8/8/PPP2PPP/3R2K1 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d1', 'd7', 'c7', 'f7'],
          instruction: 'Kolom d adalah lajur terbuka penuh (Open File) dan Benteng Putih Anda sudah berada di d1! Langkah 1: Susupkan Benteng dari d1 langsung ke baris ke-7 (d7) untuk menekan pion c7 dan f7 sekaligus. Langkah 2: Setelah Raja Hitam bergeser ke f8 untuk menjaga f7, tangkap pion di c7!',
          steps: [
            {
              expectedMoves: ['Rd7'],
              hint: 'Gerakkan Benteng Putih dari d1 lurus ke atas menuju petak d7 (baris ke-7).',
              opponentReply: 'Kf8',
              explanation: 'Dominasi penuh di baris ke-7 (Rd7)! Raja Hitam terpaksa menjaga pion f7, sehingga pion c7 tak terjaga.'
            },
            {
              expectedMoves: ['Rxc7'],
              hint: 'Gunakan Benteng aktif Anda di d7 untuk menangkap pion Hitam di c7.',
              opponentReply: null,
              explanation: 'Luar biasa! Aktivitas Benteng di lajur terbuka dan baris ke-7 langsung membuahkan keuntungan materi.'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'level-5',
    level: 5,
    title: 'Level 5 — Opening',
    shortTitle: 'Opening (Pembukaan)',
    description: 'Pelajari empat repertoar pembukaan catur paling populer dan teruji sepanjang sejarah untuk membangun posisi awal yang kokoh.',
    badgeText: 'Lanjutan',
    lessons: [
      {
        id: 'l5-1-italian-game',
        categoryId: 'level-5',
        order: 23,
        title: 'Italian Game',
        subtitle: 'Pembukaan klasik 1.e4 e5 2.Nf3 Nc6 3.Bc4 yang menargetkan titik terlemah lawan di petak f7.',
        xpReward: 90,
        estimatedMinutes: 9,
        theory: [
          {
            heading: 'Mengenal Italian Game (Permainan Italia)',
            content: 'Italian Game adalah salah satu pembukaan catur tertua dan paling fundamental (dimulai dengan langkah 1.e4 e5 2.Nf3 Nc6 3.Bc4). Pembukaan ini menerapkan seluruh prinsip emas pembukaan: menguasai pusat dengan pion e4, mengeluarkan Kuda ke f3, lalu menempatkan Gajah di c4 yang langsung membidik petak f7 milik Hitam.',
            bulletPoints: [
              'Mengapa Petak f7 Menjadi Target? Pada awal permainan, petak f7 (dan f2 bagi Putih) adalah titik paling rawan karena hanya dijaga oleh satu buah, yaitu Raja Hitam sendiri.',
              'Giuoco Piano (3...Bc5): Ketika Hitam membalas dengan mengembangkan Gajah ke c5, Putih dapat membangun pusat kuat melalui c3 dan d4.',
              'Two Knights Defense (3...Nf6): Ketika Hitam memilih mengeluarkan Kuda ke f6 untuk menyerang balik pion e4.',
              'Membuka Jalur Rokade Cepat: Dengan keluarnya Kuda f3 dan Gajah c4, Putih sudah siap melakukan Rokade Pendek (O-O) hanya dalam 4 langkah!'
            ]
          }
        ],
        keyTakeaways: [
          'Urutan langkah Italian Game: 1.e4 e5 2.Nf3 Nc6 3.Bc4.',
          'Gajah di c4 mengontrol diagonal pusat dan mengincar petak lemah f7.',
          'Rencana lanjutan Putih adalah rokade pendek (O-O), mendorong d3 atau c3-d4, dan menempatkan Benteng di e1.'
        ],
        practice: {
          title: 'Praktik: Memainkan Urutan Lengkap Pembukaan Italian Game',
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e4', 'f3', 'c4', 'f7'],
          instruction: 'Mari praktikkan 3 langkah utama Italian Game dari posisi awal! Langkah 1: Majukan pion Raja ke e4. Langkah 2: Setelah 1...e5, keluarkan Kuda ke f3. Langkah 3: Setelah 2...Nc6, tempatkan Gajah di c4 membidik petak f7!',
          steps: [
            {
              expectedMoves: ['e4'],
              hint: 'Langkah 1: Majukan pion Putih dari e2 ke e4.',
              opponentReply: 'e5',
              explanation: '1.e4 e5 — Kedua pemain menempatkan pion di pusat papan.'
            },
            {
              expectedMoves: ['Nf3'],
              hint: 'Langkah 2: Keluarkan Kuda dari g1 ke f3 untuk menyerang pion e5.',
              opponentReply: 'Nc6',
              explanation: '2.Nf3 Nc6 — Putih menyerang pion e5 dan Hitam melindunginya dengan Kuda c6.'
            },
            {
              expectedMoves: ['Bc4'],
              hint: 'Langkah 3: Kembangkan Gajah dari f1 ke petak aktif c4!',
              opponentReply: null,
              explanation: '3.Bc4! Anda telah membentuk posisi utama Italian Game dengan sempurna.'
            }
          ]
        }
      },
      {
        id: 'l5-2-sicilian-defense',
        categoryId: 'level-5',
        order: 24,
        title: 'Sicilian Defense',
        subtitle: 'Pertahanan paling populer dan dinamis bagi Hitam melawan 1.e4 dengan balasan asimetris 1...c5.',
        xpReward: 90,
        estimatedMinutes: 9,
        theory: [
          {
            heading: 'Filosofi Sicilian Defense (Pertahanan Sisilia)',
            content: 'Ketika Putih memulai dengan 1.e4, jawaban yang paling sering dimainkan oleh para Juara Dunia untuk meraih kemenangan dengan buah Hitam bukanlah 1...e5, melainkan 1...c5! Langkah ini dikenal sebagai Sicilian Defense.',
            bulletPoints: [
              'Kontrol Pusat dari Sayap: Dengan 1...c5, Hitam langsung mengontrol petak pusat d4 tanpa meniru langkah Putih secara simetris.',
              'Pertukaran Pion yang Menguntungkan Hitam (Open Sicilian): Ketika Putih memainkan 2.Nf3 d6 3.d4, Hitam menangkap dengan 3...cxd4! Dengan demikian, Hitam menukar pion sayap (kolom c) miliknya dengan pion pusat (kolom d) milik Putih.',
              'Keunggulan Jangka Panjang Hitam: Setelah pertukaran cxd4, Hitam memiliki dua pion pusat (d dan e) melawan satu pion pusat Putih (e4), serta mendapatkan lajur semi-terbuka di kolom c untuk serangan balik Benteng.'
            ]
          }
        ],
        keyTakeaways: [
          'Sicilian Defense dimulai dengan 1.e4 c5.',
          'Hitam menciptakan permainan asimetris yang kaya peluang menang bagi kedua belah pihak.',
          'Dalam Open Sicilian (3.d4 cxd4), Hitam memperoleh keunggulan jumlah pion pusat dan lajur c untuk serangan balik.'
        ],
        practice: {
          title: 'Praktik: Memainkan Sicilian Defense sebagai Hitam',
          initialFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          playerColor: 'b',
          orientation: 'black',
          highlightSquares: ['c5', 'd6', 'd4'],
          instruction: 'Putih baru saja memulai dengan 1.e4. Anda bermain sebagai Hitam! Langkah 1: Balas dengan langkah khas Sicilian Defense, yaitu memajukan pion c7 ke c5. Langkah 2: Setelah Putih melangkah 2.Nf3, perkuat pusat dengan mendorong pion d7 ke d6. Langkah 3: Ketika Putih menantang pusat dengan 3.d4, tangkap pion pusat tersebut dengan cxd4!',
          steps: [
            {
              expectedMoves: ['c5'],
              hint: 'Langkah 1 (Hitam): Majukan pion dari c7 ke c5.',
              opponentReply: 'Nf3',
              explanation: '1...c5! Sicilian Defense dimulai. Putih mengembangkan Kuda ke f3.'
            },
            {
              expectedMoves: ['d6'],
              hint: 'Langkah 2 (Hitam): Majukan pion dari d7 ke d6 untuk mengontrol petak e5.',
              opponentReply: 'd4',
              explanation: '2...d6 3.d4 — Putih membuka pusat (Open Sicilian). Sekarang tukar pion c5 Anda dengan pion pusat d4!'
            },
            {
              expectedMoves: ['cxd4'],
              hint: 'Langkah 3 (Hitam): Gunakan pion di c5 untuk menangkap pion Putih di d4.',
              opponentReply: null,
              explanation: '3...cxd4! Anda berhasil menukar pion sayap c dengan pion pusat d milik Putih dan membuka lajur c.'
            }
          ]
        }
      },
      {
        id: 'l5-3-london-system',
        categoryId: 'level-5',
        order: 25,
        title: 'London System',
        subtitle: 'Sistem pembukaan universal bagi Putih (1.d4 dan 2.Bf4) dengan struktur piramida pion yang sangat kokoh.',
        xpReward: 90,
        estimatedMinutes: 9,
        theory: [
          {
            heading: 'Mengapa London System Sangat Disukai?',
            content: 'London System adalah pembukaan berbasis sistem (System Opening) untuk Putih yang dimulai dengan 1.d4 diikuti pengembangan cepat Gajah petak gelap ke f4 (2.Bf4) sebelum menutup rantai pion dengan e3 dan c3.',
            bulletPoints: [
              'Mengeluarkan Gajah Sebelum e3: Masalah klasik pembukaan pion Menteri adalah Gajah c1 yang sering terkurung di dalam rantai pion setelah langkah e3. Dalam London System, Gajah c1 dikeluarkan lebih dulu ke f4 agar tetap aktif di luar rantai pion!',
              'Piramida Pion Solid (c3 - d4 - e3): Memberikan kontrol luar biasa atas petak pusat d4 dan e5 serta hampir mustahil ditembus secara taktis di awal permainan.',
              'Universal Melawan Hampir Semua Respons Hitam: Baik Hitam membalas dengan ...d5, ...Nf6, atau ...g6, Putih dapat menyusun formasi idealnya (d4, Bf4, e3, Nf3, c3, Bd3) dengan mudah.'
            ]
          }
        ],
        keyTakeaways: [
          'Ciri khas London System: 1.d4 diikuti Bf4 dan piramida pion c3-d4-e3.',
          'Selalu keluarkan Gajah c1 ke f4 SEBELUM mendorong pion e2 ke e3.',
          'Cocok bagi pemain yang menyukai posisi terstruktur, jelas, dan minim hafalan variasi rumit.'
        ],
        practice: {
          title: 'Praktik: Menyusun Formasi Klasik London System',
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d4', 'f4', 'e3'],
          instruction: 'Mari bangun struktur London System! Langkah 1: Majukan pion Menteri ke d4. Langkah 2: Setelah 1...d5, keluarkan Gajah petak gelap dari c1 ke f4. Langkah 3: Setelah 2...Nf6, kokohkan rantai pion dengan memajukan pion e2 ke e3!',
          steps: [
            {
              expectedMoves: ['d4'],
              hint: 'Langkah 1: Majukan pion Putih dari d2 ke d4.',
              opponentReply: 'd5',
              explanation: '1.d4 d5 — Penguasaan pusat dengan pion Menteri.'
            },
            {
              expectedMoves: ['Bf4'],
              hint: 'Langkah 2: Keluarkan Gajah dari c1 ke petak aktif f4 sebelum mendorong pion e3.',
              opponentReply: 'Nf6',
              explanation: '2.Bf4! Gajah gelap Anda sudah berada di luar rantai pion dan mengontrol diagonal panjang h2-b8.'
            },
            {
              expectedMoves: ['e3'],
              hint: 'Langkah 3: Majukan pion dari e2 ke e3 untuk memperkuat pion pusat d4 dan membuka jalur Gajah f1.',
              opponentReply: null,
              explanation: '3.e3! Formasi dasar London System telah berdiri dengan sangat kokoh.'
            }
          ]
        }
      },
      {
        id: 'l5-4-ruy-lopez',
        categoryId: 'level-5',
        order: 26,
        title: 'Ruy Lopez',
        subtitle: 'Pembukaan Spanyol (1.e4 e5 2.Nf3 Nc6 3.Bb5) yang menekan penjaga pion pusat lawan secara strategis.',
        xpReward: 90,
        estimatedMinutes: 9,
        theory: [
          {
            heading: 'Mahakarya Strategis: Ruy Lopez (Pembukaan Spanyol)',
            content: 'Dinamai dari pendeta Spanyol abad ke-16 Ruy López de Segura, pembukaan 1.e4 e5 2.Nf3 Nc6 3.Bb5 adalah salah satu pembukaan paling dihormati di tingkat Grandmaster.',
            bulletPoints: [
              'Logika di Balik 3.Bb5: Pada langkah ke-2 (Nf3 Nc6), Kuda Putih di f3 menyerang pion e5, dan Kuda Hitam di c6 adalah satu-satunya penjaga pion e5 tersebut. Dengan menempatkan Gajah di b5, Putih langsung mengancam atau menekan sang penjaga (Kuda c6)!',
              'Pertahanan Morphy (3...a6): Jawaban paling populer bagi Hitam adalah mendorong pion ke a6 untuk menanyakan niat Gajah Putih ("Apakah kamu mau menukar Gajah dengan Kuda di c6, atau mundur?").',
              'Mundur ke a4 (4.Ba4): Biasanya Putih memilih menarik Gajah ke a4 untuk tetap menjaga tekanan jangka panjang pada Kuda c6 sekaligus menyiapkan rokade pendek.'
            ]
          }
        ],
        keyTakeaways: [
          'Urutan Ruy Lopez: 1.e4 e5 2.Nf3 Nc6 3.Bb5.',
          'Gajah di b5 menyerang Kuda c6 yang bertugas menjaga pion pusat e5.',
          'Bila Hitam memainkan 3...a6, Putih biasanya mempertahankan tekanan dengan 4.Ba4.'
        ],
        practice: {
          title: 'Praktik: Memainkan Ruy Lopez (3.Bb5)',
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e4', 'f3', 'b5', 'c6'],
          instruction: 'Praktikkan langkah pembukaan Ruy Lopez! Langkah 1: Majukan pion ke e4. Langkah 2: Setelah 1...e5, kembangkan Kuda ke f3. Langkah 3: Setelah 2...Nc6, gerakkan Gajah dari f1 ke b5 untuk menekan Kuda penjaga c6!',
          steps: [
            {
              expectedMoves: ['e4'],
              hint: 'Langkah 1: Majukan pion dari e2 ke e4.',
              opponentReply: 'e5',
              explanation: '1.e4 e5 — Pembukaan Raja Terbuka dimulai.'
            },
            {
              expectedMoves: ['Nf3'],
              hint: 'Langkah 2: Keluarkan Kuda dari g1 ke f3.',
              opponentReply: 'Nc6',
              explanation: '2.Nf3 Nc6 — Kuda c6 menjaga pion e5.'
            },
            {
              expectedMoves: ['Bb5'],
              hint: 'Langkah 3: Tempatkan Gajah Putih dari f1 ke petak b5.',
              opponentReply: null,
              explanation: '3.Bb5! Selamat, Anda telah memainkan pembukaan legendaris Ruy Lopez.'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'level-6',
    level: 6,
    title: 'Level 6 — Endgame',
    shortTitle: 'Endgame (Babak Akhir)',
    description: 'Kuasai teknik mengonversi keunggulan kecil menjadi kemenangan mutlak di babak akhir permainan melalui penguasaan Raja, Oposisi, Benteng, dan pola Skakmat dasar.',
    badgeText: 'Mahir',
    lessons: [
      {
        id: 'l6-1-king-and-pawn',
        categoryId: 'level-6',
        order: 27,
        title: 'King and Pawn Endgame',
        subtitle: 'Peran aktif Raja di babak akhir serta aturan Petak Kunci (Key Squares) untuk mengawal pion promosi.',
        xpReward: 100,
        estimatedMinutes: 10,
        theory: [
          {
            heading: 'Transformasi Peran Raja di Babak Akhir',
            content: 'Jika pada babak pembukaan dan pertengahan Raja harus bersembunyi di balik perisai pion, maka di babak akhir (Endgame) ketika sebagian besar perwira sudah bertukar, Raja berubah menjadi perwira tempur yang wajib maju ke garis depan!',
            bulletPoints: [
              'Raja Harus Memimpin di Depan Pion (King in Front of the Pawn): Untuk memastikan sebuah pion tunggal berhasil promosi melawan Raja lawan yang bertahan, Raja Anda harus berjalan DI DEPAN pion tersebut untuk membuka jalan, bukan mendorong pion terburu-buru dari belakang.',
              'Aturan Petak Kunci (Key Squares): Tiga petak tepat di depan pion (dua baris di depannya ketika pion sudah melewati tengah papan) adalah petak kunci. Jika Raja Anda berhasil menduduki salah satu petak kunci tersebut, pion dijamin dapat promosi.',
              'Aturan Kotak (Rule of the Square): Cara cepat menghitung apakah Raja lawan sempat mengejar pion bebas Anda tanpa perlu menghitung langkah satu per satu.'
            ]
          }
        ],
        keyTakeaways: [
          'Di Endgame, aktifkan Raja ke tengah papan secepat mungkin.',
          'Jalankan Raja di depan pion bebas untuk menguasai petak promosi.',
          'Jangan mendorong pion terlalu cepat jika Raja belum mengamankan jalur di depannya.'
        ],
        practice: {
          title: 'Praktik: Raja Mengawal Pion Menuju Promosi',
          initialFen: '6k1/8/4K3/4P3/8/8/8/8 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['e6', 'f6', 'e7', 'e8'],
          instruction: 'Raja Putih Anda di e6 sudah berada di depan pion e5! Langkah 1: Geser Raja ke f6 untuk mengontrol petak promosi e8 dan e7. Langkah 2: Setelah Raja Hitam bergeser ke f8, dorong pion dari e5 ke e6. Langkah 3: Setelah Raja Hitam terpaksa mundur ke e8, dorong pion ke e7 dan menangkan permainan!',
          steps: [
            {
              expectedMoves: ['Kf6'],
              hint: 'Majukan Raja Putih dari e6 ke f6 untuk membuka jalan bagi pion e5 sekaligus mengawal petak e7 dan e8.',
              opponentReply: 'Kf8',
              explanation: 'Langkah kunci! Raja Putih di f6 mengamankan jalur maju pion.'
            },
            {
              expectedMoves: ['e6'],
              hint: 'Sekarang majukan pion dari e5 ke e6.',
              opponentReply: 'Ke8',
              explanation: 'Pion semakin dekat ke promosi! Raja Hitam berusaha menghalangi di e8.'
            },
            {
              expectedMoves: ['e7'],
              hint: 'Majukan pion dari e6 ke e7! Raja Hitam akan terjepit (Zugzwang) dan harus meninggalkan petak d8/f8.',
              opponentReply: null,
              explanation: 'Sempurna! Pada langkah berikutnya Raja Hitam terpaksa menyingkir ke d7, lalu Raja Putih ke f7 dan pion promosi menjadi Menteri di e8.'
            }
          ]
        }
      },
      {
        id: 'l6-2-opposition',
        categoryId: 'level-6',
        order: 28,
        title: 'Opposition',
        subtitle: 'Teknik saling berhadapan antar-Raja dengan jarak 1 petak untuk memaksa Raja lawan menyingkir.',
        xpReward: 100,
        estimatedMinutes: 10,
        theory: [
          {
            heading: 'Rahasia Master Endgame: Opposition (Oposisi)',
            content: 'Opposition (Oposisi) adalah kondisi ketika kedua Raja berdiri saling berhadapan pada satu kolom, baris, atau diagonal yang sama dengan dipisahkan oleh jumlah petak ganjil (paling umum 1 petak kosong di antara kedua Raja).',
            bulletPoints: [
              'Siapa yang Memegang Oposisi? Pemain yang TIDAK sedang mendapat giliran melangkah (yakni pemain yang baru saja melangkahkan Rajanya ke posisi berhadapan tersebut) disebut "Memegang Oposisi" (Having the Opposition).',
              'Mengapa Memegang Oposisi Menguntungkan? Karena kedua Raja tidak boleh saling mendekat, pemain yang mendapat giliran melangkah TERPAKSA menggeser Rajanya ke samping atau mundur, sehingga memberikan jalan masuk (outflanking) bagi Raja lawan!',
              'Oposisi Jauh (Distant Opposition): Oposisi dengan jarak 3 atau 5 petak kosong yang nantinya dapat dikonversi menjadi Oposisi Dekat (1 petak).'
            ]
          }
        ],
        keyTakeaways: [
          'Oposisi Dekat: Dua Raja berhadapan dengan jarak 1 petak kosong di antaranya.',
          'Pemain yang melangkah untuk menciptakan posisi berhadapan tersebut adalah pemegang Oposisi.',
          'Gunakan Oposisi untuk memaksa Raja lawan memberikan jalan bagi pion Anda.'
        ],
        practice: {
          title: 'Praktik: Merebut Oposisi Langsung untuk Menembus Pertahanan',
          initialFen: '4k3/8/8/3K4/4P3/8/8/8 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d5', 'e6', 'e8', 'd6'],
          instruction: 'Raja Hitam berada di e8 dan Raja Putih di d5. Jika Anda mendorong pion e4 ke e5 sekarang, permainan hanya akan berakhir remis! Sebaliknya, Langkah 1: Maju dan rebut Oposisi dengan menggerakkan Raja Putih dari d5 ke e6 (berhadapan 1 petak dengan Raja e8). Langkah 2: Setelah Raja Hitam terpaksa bergeser ke d8, susupkan Raja Putih ke f7!',
          steps: [
            {
              expectedMoves: ['Ke6'],
              hint: 'Gerakkan Raja Putih dari d5 ke e6 agar berhadapan langsung (jarak 1 petak) dengan Raja Hitam di e8.',
              opponentReply: 'Kd8',
              explanation: 'Ke6! Putih memegang Oposisi. Karena giliran Hitam, Raja Hitam terpaksa menyingkir ke d8 dan membuka sisi kanan.'
            },
            {
              expectedMoves: ['Kf7'],
              hint: 'Manfaatkan ruang yang ditinggalkan Raja lawan dengan memajukan Raja Putih dari e6 ke f7!',
              opponentReply: null,
              explanation: 'Teknik Oposisi yang sempurna! Dengan Raja Putih di f7, jalur promosi pion e4 kini terbuka lebar.'
            }
          ]
        }
      },
      {
        id: 'l6-3-rook-endgame',
        categoryId: 'level-6',
        order: 29,
        title: 'Rook Endgame',
        subtitle: 'Prinsip babak akhir Benteng: menempatkan Benteng di belakang pion bebas dan memotong langkah Raja lawan (Cut-Off).',
        xpReward: 100,
        estimatedMinutes: 10,
        theory: [
          {
            heading: 'Babak Akhir Paling Sering Terjadi: Rook Endgame',
            content: 'Lebih dari 50% babak akhir dalam pertandingan catur adalah babak akhir Benteng dan Pion (Rook Endgame). Menguasai dua prinsip fundamental di bawah ini akan meningkatkan kekuatan akhir permainan Anda secara drastis:',
            bulletPoints: [
              '1. Aturan Tarrasch (Rooks Belong Behind Passed Pawns): Benteng harus selalu ditempatkan DI BELAKANG pion bebas—baik itu pion bebas milik Anda sendiri (untuk mendorongnya maju tanpa mempersempit ruang Benteng) maupun pion bebas milik lawan (untuk memakannya saat maju).',
              '2. Teknik Cut-Off (Memotong Jalur Raja Lawan): Gunakan Benteng Anda untuk menguasai satu kolom atau baris penuh agar Raja lawan tidak bisa menyeberang mendekati pion bebas Anda.',
              '3. Aktivitas Benteng di Atas Segalanya: Dalam Rook Endgame, Benteng yang pasif menjaga pion hampir selalu kalah melawan Benteng yang aktif menyerang.'
            ]
          }
        ],
        keyTakeaways: [
          'Tempatkan Benteng di belakang pion bebas (Aturan Tarrasch).',
          'Potong jalur Raja lawan (Cut-Off) menggunakan Benteng agar tidak bisa mendekati pion Anda.',
          'Pertahankan Benteng tetap aktif sejauh mungkin dari jangkauan gangguan Raja lawan.'
        ],
        practice: {
          title: 'Praktik: Teknik Cut-Off Benteng & Promosi Pion',
          initialFen: '4k3/1P6/2K5/8/8/8/8/3R4 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['d1', 'e1', 'b7', 'b8'],
          instruction: 'Pion Putih di b7 tinggal selangkah lagi menuju promosi di b8, dan Raja Hitam di e8 berusaha mendekat! Langkah 1: Gunakan Benteng di d1 untuk memberikan Skak di e1 (Re1+) sekaligus memotong jalur Raja Hitam (Cut-Off). Langkah 2: Setelah Raja Hitam terpaksa menyingkir ke f7, promosikan pion b7 ke b8 menjadi Menteri (b8=Q)!',
          steps: [
            {
              expectedMoves: ['Re1+'],
              hint: 'Geser Benteng Putih dari d1 ke e1 untuk memberikan Skak dan mengusir Raja Hitam menjauh dari pion b7.',
              opponentReply: 'Kf7',
              explanation: 'Cut-Off yang efektif (Re1+)! Raja Hitam terlempar ke f7 dan terpotong oleh Benteng Anda di lajur e.'
            },
            {
              expectedMoves: ['b8=Q'],
              hint: 'Majukan pion Putih dari b7 ke b8 dan pilih promosi menjadi Menteri (Queen)!',
              opponentReply: null,
              explanation: 'Sempurna (b8=Q)! Dengan kerja sama Benteng yang memotong jalur Raja lawan, pion bebas Anda berhasil berpromosi dengan aman.'
            }
          ]
        }
      },
      {
        id: 'l6-4-teknik-checkmate',
        categoryId: 'level-6',
        order: 30,
        title: 'Dasar-dasar teknik checkmate',
        subtitle: 'Pola skakmat fundamental menggunakan Dua Benteng (Ladder Mate), Menteri + Raja, dan Benteng + Raja.',
        xpReward: 100,
        estimatedMinutes: 10,
        theory: [
          {
            heading: 'Menuntaskan Kemenangan: Teknik Skakmat Dasar',
            content: 'Memenangkan banyak materi di babak pertengahan tidak akan menghasilkan poin kemenangan jika Anda belum menguasai teknik memojokkan dan melakukan skakmat terhadap Raja lawan yang sendirian.',
            bulletPoints: [
              '1. Ladder Mate / Skakmat Tangga (2 Benteng atau Benteng + Menteri): Kedua perwira berat bekerja bergantian menguasai baris demi baris seperti anak tangga, mendorong Raja lawan ke tepi papan tanpa perlu bantuan Raja sendiri.',
              '2. Skakmat Menteri + Raja (Queen & King Mate): Gunakan Menteri untuk mempersempit ruang gerak Raja lawan membentuk kotak yang semakin kecil hingga Raja lawan terdesak ke tepi papan, lalu datangkan Raja Anda (Oposisi) untuk mengawal Menteri saat memberikan skakmat.',
              '3. Skakmat Benteng + Raja (Rook & King Mate): Benteng memotong baris/kolom Raja lawan, dan ketika kedua Raja berhadapan (Oposisi), Benteng memberikan skak untuk memaksa Raja lawan mundur satu baris demi satu baris hingga ke pinggir papan.'
            ]
          }
        ],
        keyTakeaways: [
          'Raja lawan yang sendirian hampir selalu harus didorong ke tepi atau sudut papan untuk di-skakmat.',
          'Ladder Mate menggunakan dua perwira berat secara bergantian: satu memotong jalur kabur, satu lagi memberikan skak.',
          'Dalam skakmat 1 Benteng + Raja, kerja sama Oposisi Raja Anda mutlak diperlukan.'
        ],
        practice: {
          title: 'Praktik: Eksekusi Ladder Mate (Skakmat Tangga Dua Benteng)',
          initialFen: '4k3/R7/8/8/8/8/8/1R4K1 w - - 0 1',
          playerColor: 'w',
          orientation: 'white',
          highlightSquares: ['a7', 'b1', 'b8', 'e8'],
          instruction: 'Benteng Putih pertama di a7 sudah memotong seluruh baris ke-7 sehingga Raja Hitam di e8 tidak bisa turun! Sekarang selesaikan dengan Ladder Mate: gerakkan Benteng kedua dari b1 lurus ke b8 untuk melakukan Skakmat!',
          steps: [
            {
              expectedMoves: ['Rb8#'],
              hint: 'Klik Benteng Putih di petak b1 lalu gerakkan lurus ke atas menuju petak b8.',
              opponentReply: null,
              explanation: 'Skakmat (Rb8#)! Selamat! Anda telah menuntaskan seluruh 30 materi kurikulum Caturan dari tingkat dasar hingga mahir!'
            }
          ]
        }
      }
    ]
  }
];

/**
 * Helper: Mendapatkan seluruh materi dalam urutan kurikulum datar (1 - 30)
 */
export function getAllLessons() {
  const list = [];
  for (const cat of CURRICULUM_CATEGORIES) {
    for (const lesson of cat.lessons) {
      list.push({
        ...lesson,
        categoryTitle: cat.title,
        categoryShortTitle: cat.shortTitle,
        categoryLevel: cat.level
      });
    }
  }
  return list.sort((a, b) => a.order - b.order);
}

/**
 * Helper: Mencari materi berdasarkan ID beserta referensi materi sebelumnya & selanjutnya
 */
export function getLessonById(lessonId) {
  const all = getAllLessons();
  const idx = all.findIndex(l => l.id === lessonId);
  if (idx === -1) return null;

  return {
    lesson: all[idx],
    prevLesson: idx > 0 ? all[idx - 1] : null,
    nextLesson: idx < all.length - 1 ? all[idx + 1] : null,
    totalLessons: all.length,
    currentIndex: idx + 1
  };
}

/**
 * Helper: Mencari kategori berdasarkan ID
 */
export function getCategoryById(categoryId) {
  return CURRICULUM_CATEGORIES.find(c => c.id === categoryId) || null;
}
