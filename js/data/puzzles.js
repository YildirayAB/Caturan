/**
 * Dataset Puzzle Catur Terkurasi — Caturan MVP 2
 * Sumber: Lichess Open Database — CC0 Public Domain (https://database.lichess.org/#puzzles)
 * Sinkron 100% dengan js/data/puzzles.json (60 puzzle tervalidasi Chess.js).
 */

export const PUZZLE_CATEGORIES = [
  {
    id: 'mateIn1',
    title: 'Mat dalam 1',
    shortTitle: 'Mat dalam 1',
    description:
      'Temukan satu langkah mematikan yang langsung mengunci Raja lawan dalam kondisi skakmat (checkmate) tanpa jalan keluar.',
    generalHint:
      'Tema Mat dalam 1: Cari langkah skak yang langsung mematikan Raja lawan sehingga tidak bisa lari, menutup serangan, atau menangkap bidak penyerang.'
  },
  {
    id: 'mateIn2',
    title: 'Mat dalam 2',
    shortTitle: 'Mat dalam 2',
    description:
      'Rancang kombinasi paksa dua langkah beruntun: langkah pertama membatasi ruang gerak Raja lawan, langkah kedua mengeksekusi skakmat.',
    generalHint:
      'Tema Mat dalam 2: Cari langkah pemaksa (biasanya skak atau ancaman mutlak) yang memaksa respons tunggal lawan sebelum skakmat pada langkah kedua.'
  },
  {
    id: 'fork',
    title: 'Garpu',
    shortTitle: 'Garpu',
    description:
      'Serang dua atau lebih bidak berharga lawan sekaligus menggunakan satu bidak penyerang untuk memenangkan materi.',
    generalHint:
      'Tema Garpu (Fork): Perhatikan dua perwira atau Raja lawan yang dapat diserang secara bersamaan oleh satu bidak Anda pada satu petak cabang.'
  },
  {
    id: 'pin',
    title: 'Pin / Ikatan',
    shortTitle: 'Pin / Ikatan',
    description:
      'Manfaatkan perwira jarak jauh (Gajah, Benteng, atau Menteri) untuk mengikat bidak lawan yang melindungi Raja atau perwira bernilai tinggi di belakangnya.',
    generalHint:
      'Tema Pin / Ikatan: Cari jalur lurus atau diagonal di mana bidak lawan terikat di depan Raja atau perwira mahalnya, lalu manfaatkan ikatan tersebut.'
  },
  {
    id: 'skewer',
    title: 'Tusukan',
    shortTitle: 'Tusukan',
    description:
      'Serang bidak lawan yang paling berharga secara segaris sehingga ketika bidak tersebut menghindar, bidak di belakangnya dapat ditangkap.',
    generalHint:
      'Tema Tusukan (Skewer): Bidik Raja atau perwira bernilai tinggi lawan pada satu lajur, baris, atau diagonal yang menembus ke bidak lawan lain di belakangnya.'
  },
  {
    id: 'discoveredAttack',
    title: 'Serangan Terbuka',
    shortTitle: 'Serangan Terbuka',
    description:
      'Gerakkan satu bidak untuk membuka jalur serangan tersembunyi dari perwira jarak jauh di belakangnya sambil menciptakan ancaman ganda.',
    generalHint:
      'Tema Serangan Terbuka: Pindahkan bidak penutup dengan langkah yang mengancam atau memberi skak untuk membuka jalur tembak perwira di belakangnya.'
  }
];

export const PUZZLE_DIFFICULTIES = [
  {
    id: 'beginner',
    title: 'Pemula',
    ratingRange: '600–1199',
    minRating: 600,
    maxRating: 1199,
    description: 'Pola taktik dasar yang ideal untuk membangun ketajaman visual di atas papan.'
  },
  {
    id: 'intermediate',
    title: 'Menengah',
    ratingRange: '1200–1799',
    minRating: 1200,
    maxRating: 1799,
    description: 'Kombinasi taktik multi-langkah yang menuntut perhitungan balasan lawan secara akurat.'
  },
  {
    id: 'advanced',
    title: 'Lanjutan',
    ratingRange: '1800–2400',
    minRating: 1800,
    maxRating: 2400,
    description: 'Posisi taktik kompleks tingkat turnamen dengan urutan langkah presisi tinggi.'
  }
];

export const PUZZLES_DATA = [
  {
    "id": "000rZ",
    "initialFen": "2kr1b1r/p1p2pp1/2pqb3/7p/3N2n1/2NPB3/PPP2PPP/R2Q1RK1 w - - 2 13",
    "puzzleFen": "2kr1b1r/p1p2pp1/2pqN3/7p/6n1/2NPB3/PPP2PPP/R2Q1RK1 b - - 0 13",
    "setupMove": "d4e6",
    "setupMoveSan": "Nxe6",
    "moves": [
      "d4e6",
      "d6h2"
    ],
    "solutionMoves": [
      "d6h2"
    ],
    "solutionSan": [
      "Qxh2#"
    ],
    "playerColor": "black",
    "rating": 638,
    "ratingDeviation": 92,
    "popularity": 100,
    "nbPlays": 646,
    "difficulty": "beginner",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/seIMDWkD#25",
    "openingTags": [
      "Scandinavian_Defense",
      "Scandinavian_Defense_Modern_Variation"
    ]
  },
  {
    "id": "0082f",
    "initialFen": "r4rk1/2q2ppp/3pp3/4Pb1N/pp6/1B4Q1/PPP3PP/1K1RR3 b - - 0 21",
    "puzzleFen": "r4rk1/2q2ppp/3pp3/4Pb1N/1p6/1p4Q1/PPP3PP/1K1RR3 w - - 0 22",
    "setupMove": "a4b3",
    "setupMoveSan": "axb3",
    "moves": [
      "a4b3",
      "g3g7"
    ],
    "solutionMoves": [
      "g3g7"
    ],
    "solutionSan": [
      "Qxg7#"
    ],
    "playerColor": "white",
    "rating": 864,
    "ratingDeviation": 77,
    "popularity": 100,
    "nbPlays": 575,
    "difficulty": "beginner",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/fHfmODEz/black#42",
    "openingTags": []
  },
  {
    "id": "00AfZ",
    "initialFen": "2r3kR/Q7/5q2/1brpN3/5Pp1/4P1P1/6K1/1B6 b - - 2 43",
    "puzzleFen": "2r3kq/Q7/8/1brpN3/5Pp1/4P1P1/6K1/1B6 w - - 0 44",
    "setupMove": "f6h8",
    "setupMoveSan": "Qxh8",
    "moves": [
      "f6h8",
      "a7f7"
    ],
    "solutionMoves": [
      "a7f7"
    ],
    "solutionSan": [
      "Qf7#"
    ],
    "playerColor": "white",
    "rating": 972,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 572,
    "difficulty": "beginner",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/xSsuq2RP/black#86",
    "openingTags": []
  },
  {
    "id": "00A9Q",
    "initialFen": "2rq1rk1/1p3p1p/p1pn2p1/P2p4/1P1PnP2/3NP3/5PBP/R1Q3RK w - - 2 22",
    "puzzleFen": "2rq1rk1/1p3p1p/p1pn2p1/P1Np4/1P1PnP2/4P3/5PBP/R1Q3RK b - - 3 22",
    "setupMove": "d3c5",
    "setupMoveSan": "Nc5",
    "moves": [
      "d3c5",
      "e4f2"
    ],
    "solutionMoves": [
      "e4f2"
    ],
    "solutionSan": [
      "Nxf2#"
    ],
    "playerColor": "black",
    "rating": 669,
    "ratingDeviation": 80,
    "popularity": 100,
    "nbPlays": 560,
    "difficulty": "beginner",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/Eek8XUCN#43",
    "openingTags": []
  },
  {
    "id": "00HXr",
    "initialFen": "2k4r/Q1p2pp1/5n2/3rNq2/4p2p/6Pb/PPP1BP1P/R3R1K1 b - - 1 22",
    "puzzleFen": "2k4r/Q1p2pp1/5n2/3rNq2/4p3/6pb/PPP1BP1P/R3R1K1 w - - 0 23",
    "setupMove": "h4g3",
    "setupMoveSan": "hxg3",
    "moves": [
      "h4g3",
      "a7a8"
    ],
    "solutionMoves": [
      "a7a8"
    ],
    "solutionSan": [
      "Qa8#"
    ],
    "playerColor": "white",
    "rating": 1386,
    "ratingDeviation": 77,
    "popularity": 100,
    "nbPlays": 1241,
    "difficulty": "intermediate",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/c18wDmSc/black#44",
    "openingTags": []
  },
  {
    "id": "00Qqp",
    "initialFen": "6k1/8/p3P1p1/8/8/2P3PP/1r5r/R3RK2 w - - 0 46",
    "puzzleFen": "6k1/4P3/p5p1/8/8/2P3PP/1r5r/R3RK2 b - - 0 46",
    "setupMove": "e6e7",
    "setupMoveSan": "e7",
    "moves": [
      "e6e7",
      "h2h1"
    ],
    "solutionMoves": [
      "h2h1"
    ],
    "solutionSan": [
      "Rh1#"
    ],
    "playerColor": "black",
    "rating": 1684,
    "ratingDeviation": 75,
    "popularity": 99,
    "nbPlays": 2748,
    "difficulty": "intermediate",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/KZM4JRxc#91",
    "openingTags": []
  },
  {
    "id": "009J1",
    "initialFen": "rn2k2r/pp2bp1p/2p1pNp1/6B1/5P2/7P/PPP4P/2K1RR2 b - - 3 17",
    "puzzleFen": "rn3k1r/pp2bp1p/2p1pNp1/6B1/5P2/7P/PPP4P/2K1RR2 w - - 4 18",
    "setupMove": "e8f8",
    "setupMoveSan": "Kf8",
    "moves": [
      "e8f8",
      "g5h6"
    ],
    "solutionMoves": [
      "g5h6"
    ],
    "solutionSan": [
      "Bh6#"
    ],
    "playerColor": "white",
    "rating": 1288,
    "ratingDeviation": 76,
    "popularity": 98,
    "nbPlays": 1220,
    "difficulty": "intermediate",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/lPhlt9XF/black#34",
    "openingTags": [
      "Pirc_Defense",
      "Pirc_Defense_Byrne_Variation"
    ]
  },
  {
    "id": "0Iq7Y",
    "initialFen": "8/4Q1B1/p5p1/1p4kp/P2p4/7P/1r3qPK/8 b - - 5 42",
    "puzzleFen": "8/4Q1B1/p5p1/1p5p/P2p1k2/7P/1r3qPK/8 w - - 6 43",
    "setupMove": "g5f4",
    "setupMoveSan": "Kf4",
    "moves": [
      "g5f4",
      "e7e5"
    ],
    "solutionMoves": [
      "e7e5"
    ],
    "solutionSan": [
      "Qe5#"
    ],
    "playerColor": "white",
    "rating": 1816,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 409,
    "difficulty": "advanced",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/ZAzJzm6m/black#84",
    "openingTags": []
  },
  {
    "id": "0E0A7",
    "initialFen": "6k1/P6p/Q2pr1pb/5p2/7P/R1B5/2PK1P2/7q w - - 4 28",
    "puzzleFen": "6k1/P6p/Q2pr1pb/5p2/7P/R1BK4/2P2P2/7q b - - 5 28",
    "setupMove": "d2d3",
    "setupMoveSan": "Kd3",
    "moves": [
      "d2d3",
      "h1e4"
    ],
    "solutionMoves": [
      "h1e4"
    ],
    "solutionSan": [
      "Qe4#"
    ],
    "playerColor": "black",
    "rating": 2183,
    "ratingDeviation": 82,
    "popularity": 98,
    "nbPlays": 1772,
    "difficulty": "advanced",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/ZU4BGZR6#55",
    "openingTags": []
  },
  {
    "id": "0ND4d",
    "initialFen": "r1bqrb1k/pp4B1/2p2pQ1/4nN2/3P4/2P5/PP3PPP/R4RK1 b - - 8 18",
    "puzzleFen": "r1bqrbk1/pp4B1/2p2pQ1/4nN2/3P4/2P5/PP3PPP/R4RK1 w - - 9 19",
    "setupMove": "h8g8",
    "setupMoveSan": "Kg8",
    "moves": [
      "h8g8",
      "f5h6"
    ],
    "solutionMoves": [
      "f5h6"
    ],
    "solutionSan": [
      "Nh6#"
    ],
    "playerColor": "white",
    "rating": 1964,
    "ratingDeviation": 78,
    "popularity": 95,
    "nbPlays": 5890,
    "difficulty": "advanced",
    "primaryTheme": "mateIn1",
    "themes": [
      "mateIn1"
    ],
    "gameUrl": "https://lichess.org/game/S8luHeFY/black#36",
    "openingTags": [
      "Caro-Kann_Defense",
      "Caro-Kann_Defense_Tartakower_Variation"
    ]
  },
  {
    "id": "001w5",
    "initialFen": "1rb2rk1/q5P1/4p2p/3p3p/3P1P2/2P5/2QK3P/3R2R1 b - - 0 29",
    "puzzleFen": "1rb3k1/q4rP1/4p2p/3p3p/3P1P2/2P5/2QK3P/3R2R1 w - - 1 30",
    "setupMove": "f8f7",
    "setupMoveSan": "Rf7",
    "moves": [
      "f8f7",
      "c2h7",
      "g8h7",
      "g7g8q"
    ],
    "solutionMoves": [
      "c2h7",
      "g8h7",
      "g7g8q"
    ],
    "solutionSan": [
      "Qh7+",
      "Kxh7",
      "g8=Q#"
    ],
    "playerColor": "white",
    "rating": 1034,
    "ratingDeviation": 83,
    "popularity": 85,
    "nbPlays": 220,
    "difficulty": "beginner",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/0e1vxAEn/black#58",
    "openingTags": []
  },
  {
    "id": "007mr",
    "initialFen": "5k2/p2r3p/1p4pP/3r1q2/3Rp3/2P5/PP3PQ1/K3R3 w - - 0 33",
    "puzzleFen": "5k2/p2r3p/1p4pP/3r1q2/4R3/2P5/PP3PQ1/K3R3 b - - 0 33",
    "setupMove": "d4e4",
    "setupMoveSan": "Rdxe4",
    "moves": [
      "d4e4",
      "d5d1",
      "e1d1",
      "d7d1"
    ],
    "solutionMoves": [
      "d5d1",
      "e1d1",
      "d7d1"
    ],
    "solutionSan": [
      "Rd1+",
      "Rxd1",
      "Rxd1#"
    ],
    "playerColor": "black",
    "rating": 628,
    "ratingDeviation": 77,
    "popularity": 100,
    "nbPlays": 209,
    "difficulty": "beginner",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/J12UnEgz#65",
    "openingTags": []
  },
  {
    "id": "00Lvv",
    "initialFen": "2k2br1/1pprn3/p4p2/4p2Q/4P2P/2NqB3/PP4PK/3R4 b - - 1 22",
    "puzzleFen": "2k2br1/1pprn3/p4p2/4p2Q/4P2P/2N1q3/PP4PK/3R4 w - - 0 23",
    "setupMove": "d3e3",
    "setupMoveSan": "Qxe3",
    "moves": [
      "d3e3",
      "h5e8",
      "d7d8",
      "d1d8"
    ],
    "solutionMoves": [
      "h5e8",
      "d7d8",
      "d1d8"
    ],
    "solutionSan": [
      "Qe8+",
      "Rd8",
      "Rxd8#"
    ],
    "playerColor": "white",
    "rating": 650,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 201,
    "difficulty": "beginner",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/PdJPXqW6/black#44",
    "openingTags": []
  },
  {
    "id": "00LNB",
    "initialFen": "kr6/1pR4p/p4R2/n2r4/P3p3/4B3/6PP/6K1 b - - 0 38",
    "puzzleFen": "kr6/1pR4p/p4R2/n7/P3p3/3rB3/6PP/6K1 w - - 1 39",
    "setupMove": "d5d3",
    "setupMoveSan": "Rd3",
    "moves": [
      "d5d3",
      "f6a6",
      "b7a6",
      "c7a7"
    ],
    "solutionMoves": [
      "f6a6",
      "b7a6",
      "c7a7"
    ],
    "solutionSan": [
      "Rxa6+",
      "bxa6",
      "Ra7#"
    ],
    "playerColor": "white",
    "rating": 1115,
    "ratingDeviation": 81,
    "popularity": 98,
    "nbPlays": 3247,
    "difficulty": "beginner",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/MQYDGoEM/black#76",
    "openingTags": []
  },
  {
    "id": "00WqT",
    "initialFen": "r4r2/1ppb1p2/p2p2pk/5P2/4P3/2PBB1R1/PKP2P1q/8 b - - 4 26",
    "puzzleFen": "r4r2/1ppb1p2/p2p2p1/5P1k/4P3/2PBB1R1/PKP2P1q/8 w - - 5 27",
    "setupMove": "h6h5",
    "setupMoveSan": "Kh5",
    "moves": [
      "h6h5",
      "d3e2",
      "h5h4",
      "e3g5"
    ],
    "solutionMoves": [
      "d3e2",
      "h5h4",
      "e3g5"
    ],
    "solutionSan": [
      "Be2+",
      "Kh4",
      "Bg5#"
    ],
    "playerColor": "white",
    "rating": 1635,
    "ratingDeviation": 77,
    "popularity": 97,
    "nbPlays": 23035,
    "difficulty": "intermediate",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/HcfiWViE/black#52",
    "openingTags": []
  },
  {
    "id": "00IUW",
    "initialFen": "8/Q1p1r1kp/5pp1/3P3r/4P3/2N2bPq/PPP2R1P/5RK1 w - - 3 23",
    "puzzleFen": "8/2p1r1kp/5pp1/3P3r/4P3/2N1QbPq/PPP2R1P/5RK1 b - - 4 23",
    "setupMove": "a7e3",
    "setupMoveSan": "Qe3",
    "moves": [
      "a7e3",
      "h3g3",
      "h2g3",
      "h5h1"
    ],
    "solutionMoves": [
      "h3g3",
      "h2g3",
      "h5h1"
    ],
    "solutionSan": [
      "Qxg3+",
      "hxg3",
      "Rh1#"
    ],
    "playerColor": "black",
    "rating": 1684,
    "ratingDeviation": 75,
    "popularity": 97,
    "nbPlays": 3328,
    "difficulty": "intermediate",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/83tyhOfz#45",
    "openingTags": []
  },
  {
    "id": "00ZEc",
    "initialFen": "1r3bk1/5p2/3P1qRP/r1n1p3/ppB5/P2Q1P2/1PP5/1K6 b - - 0 35",
    "puzzleFen": "1r3b2/5p1k/3P1qRP/r1n1p3/ppB5/P2Q1P2/1PP5/1K6 w - - 1 36",
    "setupMove": "g8h7",
    "setupMoveSan": "Kh7",
    "moves": [
      "g8h7",
      "g6g7",
      "h7h6",
      "d3h7"
    ],
    "solutionMoves": [
      "g6g7",
      "h7h6",
      "d3h7"
    ],
    "solutionSan": [
      "Rg7+",
      "Kxh6",
      "Qh7#"
    ],
    "playerColor": "white",
    "rating": 1778,
    "ratingDeviation": 73,
    "popularity": 96,
    "nbPlays": 21322,
    "difficulty": "intermediate",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/7IfLNNVB/black#70",
    "openingTags": []
  },
  {
    "id": "00TJN",
    "initialFen": "r3r1k1/pp3pB1/2q3pp/3R1b2/8/P4Q2/BP3PPP/1R4K1 b - - 0 23",
    "puzzleFen": "r3r1k1/pp3pB1/2q3pp/3R4/8/P4Q2/BP3PPP/1b4K1 w - - 0 24",
    "setupMove": "f5b1",
    "setupMoveSan": "Bxb1",
    "moves": [
      "f5b1",
      "f3f7",
      "g8f7",
      "d5d7"
    ],
    "solutionMoves": [
      "f3f7",
      "g8f7",
      "d5d7"
    ],
    "solutionSan": [
      "Qxf7+",
      "Kxf7",
      "Rd7#"
    ],
    "playerColor": "white",
    "rating": 1830,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 1238,
    "difficulty": "advanced",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/G6iE2Sej/black#46",
    "openingTags": []
  },
  {
    "id": "046AR",
    "initialFen": "3r1b1r/pp4pk/2p1p2p/5b1B/3Pq3/2P3P1/PP1K3P/R1BQ3R w - - 3 20",
    "puzzleFen": "3r1b1r/pp4pk/2p1p2p/5b2/3Pq3/2P2BP1/PP1K3P/R1BQ3R b - - 4 20",
    "setupMove": "h5f3",
    "setupMoveSan": "Bf3",
    "moves": [
      "h5f3",
      "d8d4",
      "c3d4",
      "f8b4"
    ],
    "solutionMoves": [
      "d8d4",
      "c3d4",
      "f8b4"
    ],
    "solutionSan": [
      "Rxd4+",
      "cxd4",
      "Bb4#"
    ],
    "playerColor": "black",
    "rating": 1989,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 1127,
    "difficulty": "advanced",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/YDapWTRT#39",
    "openingTags": []
  },
  {
    "id": "02Y2h",
    "initialFen": "7k/8/5p2/1b2pP2/1P2K3/P2N3r/4B1r1/R3R3 w - - 0 41",
    "puzzleFen": "7k/8/5p2/1b2pP2/1P2K3/P2N1B1r/6r1/R3R3 b - - 1 41",
    "setupMove": "e2f3",
    "setupMoveSan": "Bf3",
    "moves": [
      "e2f3",
      "b5c6",
      "e4e3",
      "h3f3"
    ],
    "solutionMoves": [
      "b5c6",
      "e4e3",
      "h3f3"
    ],
    "solutionSan": [
      "Bc6+",
      "Ke3",
      "Rxf3#"
    ],
    "playerColor": "black",
    "rating": 1968,
    "ratingDeviation": 77,
    "popularity": 100,
    "nbPlays": 203,
    "difficulty": "advanced",
    "primaryTheme": "mateIn2",
    "themes": [
      "mateIn2"
    ],
    "gameUrl": "https://lichess.org/game/jltOox36#81",
    "openingTags": []
  },
  {
    "id": "00BNd",
    "initialFen": "1rr3k1/3bppbp/3p1np1/1B1N4/P2BP3/5P2/P2R2PP/R5K1 b - - 0 21",
    "puzzleFen": "1rr3k1/4ppbp/3p1np1/1b1N4/P2BP3/5P2/P2R2PP/R5K1 w - - 0 22",
    "setupMove": "d7b5",
    "setupMoveSan": "Bxb5",
    "moves": [
      "d7b5",
      "d5e7",
      "g8f8",
      "e7c8"
    ],
    "solutionMoves": [
      "d5e7",
      "g8f8",
      "e7c8"
    ],
    "solutionSan": [
      "Nxe7+",
      "Kf8",
      "Nxc8"
    ],
    "playerColor": "white",
    "rating": 1051,
    "ratingDeviation": 79,
    "popularity": 100,
    "nbPlays": 659,
    "difficulty": "beginner",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/52dQ8pN2/black#42",
    "openingTags": []
  },
  {
    "id": "00Pc8",
    "initialFen": "rnb2r2/pp4k1/2p3pp/4Np2/2BP4/8/PP4PP/2KRR3 b - - 0 18",
    "puzzleFen": "r1b2r2/pp1n2k1/2p3pp/4Np2/2BP4/8/PP4PP/2KRR3 w - - 1 19",
    "setupMove": "b8d7",
    "setupMoveSan": "Nd7",
    "moves": [
      "b8d7",
      "e5d7",
      "c8d7",
      "e1e7",
      "g7f6",
      "e7d7"
    ],
    "solutionMoves": [
      "e5d7",
      "c8d7",
      "e1e7",
      "g7f6",
      "e7d7"
    ],
    "solutionSan": [
      "Nxd7",
      "Bxd7",
      "Re7+",
      "Kf6",
      "Rxd7"
    ],
    "playerColor": "white",
    "rating": 1044,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 557,
    "difficulty": "beginner",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/2yTBJXpZ/black#36",
    "openingTags": [
      "Caro-Kann_Defense",
      "Caro-Kann_Defense_Hillbilly_Attack"
    ]
  },
  {
    "id": "00Gvp",
    "initialFen": "8/2kn1p2/8/3P4/R7/2P1N3/1r2K3/8 w - - 13 70",
    "puzzleFen": "8/2kn1p2/8/3P4/R7/2PKN3/1r6/8 b - - 14 70",
    "setupMove": "e2d3",
    "setupMoveSan": "Kd3",
    "moves": [
      "e2d3",
      "d7c5",
      "d3d4",
      "c5a4"
    ],
    "solutionMoves": [
      "d7c5",
      "d3d4",
      "c5a4"
    ],
    "solutionSan": [
      "Nc5+",
      "Kd4",
      "Nxa4"
    ],
    "playerColor": "black",
    "rating": 851,
    "ratingDeviation": 77,
    "popularity": 100,
    "nbPlays": 411,
    "difficulty": "beginner",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/CIq1kOGh#139",
    "openingTags": []
  },
  {
    "id": "00Myw",
    "initialFen": "r1b3r1/2q2p1k/1n2p2n/p2pP1NP/P1pP1QP1/1pP5/1P3PB1/R3R1K1 b - - 4 26",
    "puzzleFen": "r1b3rk/2q2p2/1n2p2n/p2pP1NP/P1pP1QP1/1pP5/1P3PB1/R3R1K1 w - - 5 27",
    "setupMove": "h7h8",
    "setupMoveSan": "Kh8",
    "moves": [
      "h7h8",
      "f4f6",
      "g8g7",
      "f6h6"
    ],
    "solutionMoves": [
      "f4f6",
      "g8g7",
      "f6h6"
    ],
    "solutionSan": [
      "Qf6+",
      "Rg7",
      "Qxh6+"
    ],
    "playerColor": "white",
    "rating": 1532,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 1703,
    "difficulty": "intermediate",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/b9YfMjmI/black#52",
    "openingTags": []
  },
  {
    "id": "00SCA",
    "initialFen": "8/2Q5/2p2nk1/8/2r2K2/8/8/8 w - - 4 71",
    "puzzleFen": "8/2Q5/2p2nk1/4K3/2r5/8/8/8 b - - 5 71",
    "setupMove": "f4e5",
    "setupMoveSan": "Ke5",
    "moves": [
      "f4e5",
      "c4e4",
      "e5d6",
      "f6e8",
      "d6d7",
      "e8c7"
    ],
    "solutionMoves": [
      "c4e4",
      "e5d6",
      "f6e8",
      "d6d7",
      "e8c7"
    ],
    "solutionSan": [
      "Re4+",
      "Kd6",
      "Ne8+",
      "Kd7",
      "Nxc7"
    ],
    "playerColor": "black",
    "rating": 1400,
    "ratingDeviation": 77,
    "popularity": 96,
    "nbPlays": 5236,
    "difficulty": "intermediate",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/JVchiAe8#141",
    "openingTags": []
  },
  {
    "id": "00PUc",
    "initialFen": "3r3k/pp4bp/3Bn1p1/7n/8/8/PP3P1K/R4RN1 w - - 1 27",
    "puzzleFen": "3r3k/pp4bp/3Bn1p1/7n/8/8/PP3P1K/3R1RN1 b - - 2 27",
    "setupMove": "a1d1",
    "setupMoveSan": "Rad1",
    "moves": [
      "a1d1",
      "d8d6",
      "d1d6",
      "g7e5",
      "h2h1",
      "e5d6"
    ],
    "solutionMoves": [
      "d8d6",
      "d1d6",
      "g7e5",
      "h2h1",
      "e5d6"
    ],
    "solutionSan": [
      "Rxd6",
      "Rxd6",
      "Be5+",
      "Kh1",
      "Bxd6"
    ],
    "playerColor": "black",
    "rating": 1503,
    "ratingDeviation": 76,
    "popularity": 96,
    "nbPlays": 3891,
    "difficulty": "intermediate",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/F6OhRxfl#53",
    "openingTags": []
  },
  {
    "id": "00IUT",
    "initialFen": "1r2r1k1/ppp1q1pp/4b3/4P3/1Q1p1P2/8/P5PP/R1BR2K1 w - - 6 19",
    "puzzleFen": "1r2r1k1/ppp1q1pp/4b3/4P3/1Q1R1P2/8/P5PP/R1B3K1 b - - 0 19",
    "setupMove": "d1d4",
    "setupMoveSan": "Rxd4",
    "moves": [
      "d1d4",
      "c7c5",
      "b4a3",
      "c5d4",
      "a3e7",
      "e8e7"
    ],
    "solutionMoves": [
      "c7c5",
      "b4a3",
      "c5d4",
      "a3e7",
      "e8e7"
    ],
    "solutionSan": [
      "c5",
      "Qa3",
      "cxd4",
      "Qxe7",
      "Rxe7"
    ],
    "playerColor": "black",
    "rating": 1442,
    "ratingDeviation": 74,
    "popularity": 95,
    "nbPlays": 28740,
    "difficulty": "intermediate",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/93xXeKdX#37",
    "openingTags": [
      "Italian_Game",
      "Italian_Game_Classical_Variation"
    ]
  },
  {
    "id": "01GJo",
    "initialFen": "b2r3k/6pp/6q1/2QN1p2/2B1rPn1/4PKP1/PP1B4/4R2R w - - 1 28",
    "puzzleFen": "b2r3k/6pp/6q1/2QN1p2/2B1rPn1/2B1PKP1/PP6/4R2R b - - 2 28",
    "setupMove": "d2c3",
    "setupMoveSan": "Bc3",
    "moves": [
      "d2c3",
      "e4c4",
      "c5c4",
      "a8d5",
      "c4d5",
      "d8d5"
    ],
    "solutionMoves": [
      "e4c4",
      "c5c4",
      "a8d5",
      "c4d5",
      "d8d5"
    ],
    "solutionSan": [
      "Rxc4",
      "Qxc4",
      "Bxd5+",
      "Qxd5",
      "Rxd5"
    ],
    "playerColor": "black",
    "rating": 2020,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 266,
    "difficulty": "advanced",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/Y2B3GNXA#55",
    "openingTags": []
  },
  {
    "id": "00Feu",
    "initialFen": "4R1k1/p4r1p/1pp2rp1/8/5B1q/4QP1P/P1P2PK1/8 b - - 2 28",
    "puzzleFen": "4Rrk1/p6p/1pp2rp1/8/5B1q/4QP1P/P1P2PK1/8 w - - 3 29",
    "setupMove": "f7f8",
    "setupMoveSan": "Rf8",
    "moves": [
      "f7f8",
      "f4g5",
      "h4g5",
      "e3g5"
    ],
    "solutionMoves": [
      "f4g5",
      "h4g5",
      "e3g5"
    ],
    "solutionSan": [
      "Bg5",
      "Qxg5+",
      "Qxg5"
    ],
    "playerColor": "white",
    "rating": 2011,
    "ratingDeviation": 77,
    "popularity": 99,
    "nbPlays": 297,
    "difficulty": "advanced",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/IEDYgK0q/black#56",
    "openingTags": []
  },
  {
    "id": "00NHK",
    "initialFen": "r1b2rk1/1p2b1p1/pqn1p1P1/3pP3/1P1P4/P1N1P3/6P1/R2QK2R b KQ - 0 17",
    "puzzleFen": "r1b2rk1/1p2b1p1/pq2p1P1/3pn3/1P1P4/P1N1P3/6P1/R2QK2R w KQ - 0 18",
    "setupMove": "c6e5",
    "setupMoveSan": "Nxe5",
    "moves": [
      "c6e5",
      "h1h8",
      "g8h8",
      "d1h5",
      "h8g8",
      "h5h7"
    ],
    "solutionMoves": [
      "h1h8",
      "g8h8",
      "d1h5",
      "h8g8",
      "h5h7"
    ],
    "solutionSan": [
      "Rh8+",
      "Kxh8",
      "Qh5+",
      "Kg8",
      "Qh7#"
    ],
    "playerColor": "white",
    "rating": 1847,
    "ratingDeviation": 76,
    "popularity": 96,
    "nbPlays": 4729,
    "difficulty": "advanced",
    "primaryTheme": "fork",
    "themes": [
      "fork"
    ],
    "gameUrl": "https://lichess.org/game/YWzSZGeb/black#34",
    "openingTags": [
      "French_Defense",
      "French_Defense_Advance_Variation"
    ]
  },
  {
    "id": "02hRj",
    "initialFen": "8/R2P4/p4p2/3rk1p1/8/8/6P1/5K2 b - - 2 42",
    "puzzleFen": "8/R2P4/5p2/p2rk1p1/8/8/6P1/5K2 w - - 0 43",
    "setupMove": "a6a5",
    "setupMoveSan": "a5",
    "moves": [
      "a6a5",
      "a7a5",
      "d5a5",
      "d7d8q"
    ],
    "solutionMoves": [
      "a7a5",
      "d5a5",
      "d7d8q"
    ],
    "solutionSan": [
      "Rxa5",
      "Rxa5",
      "d8=Q"
    ],
    "playerColor": "white",
    "rating": 1129,
    "ratingDeviation": 85,
    "popularity": 90,
    "nbPlays": 1417,
    "difficulty": "beginner",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/T7cRomZY/black#84",
    "openingTags": []
  },
  {
    "id": "01yds",
    "initialFen": "2r3k1/5p2/4b1p1/2Q1P2p/4KP2/6P1/7P/8 w - - 3 65",
    "puzzleFen": "2r3k1/5p2/4b1p1/4P2p/3QKP2/6P1/7P/8 b - - 4 65",
    "setupMove": "c5d4",
    "setupMoveSan": "Qd4",
    "moves": [
      "c5d4",
      "c8c4",
      "d4c4",
      "e6c4"
    ],
    "solutionMoves": [
      "c8c4",
      "d4c4",
      "e6c4"
    ],
    "solutionSan": [
      "Rc4",
      "Qxc4",
      "Bxc4"
    ],
    "playerColor": "black",
    "rating": 1194,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 1406,
    "difficulty": "beginner",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/4fsHue7C#129",
    "openingTags": []
  },
  {
    "id": "00XL2",
    "initialFen": "2kr3r/ppp3pp/6q1/3Pnp2/1PP1p3/7P/P2QNPP1/R4RK1 w - - 1 17",
    "puzzleFen": "2kr3r/ppp3pp/6q1/3Pnp2/1PPQp3/7P/P3NPP1/R4RK1 b - - 2 17",
    "setupMove": "d2d4",
    "setupMoveSan": "Qd4",
    "moves": [
      "d2d4",
      "e5f3",
      "g1h1",
      "f3d4"
    ],
    "solutionMoves": [
      "e5f3",
      "g1h1",
      "f3d4"
    ],
    "solutionSan": [
      "Nf3+",
      "Kh1",
      "Nxd4"
    ],
    "playerColor": "black",
    "rating": 995,
    "ratingDeviation": 79,
    "popularity": 100,
    "nbPlays": 698,
    "difficulty": "beginner",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/WEWuNMx5#33",
    "openingTags": [
      "Scandinavian_Defense",
      "Scandinavian_Defense_Modern_Variation"
    ]
  },
  {
    "id": "00LNH",
    "initialFen": "1k2r3/pp2r2p/2pqbpp1/3n4/2BP1p2/5N1P/PPQB1PP1/1K1RR3 w - - 2 22",
    "puzzleFen": "1k2r3/pp2r2p/2pqbpp1/3n4/3P1p2/1B3N1P/PPQB1PP1/1K1RR3 b - - 3 22",
    "setupMove": "c4b3",
    "setupMoveSan": "Bb3",
    "moves": [
      "c4b3",
      "e6f5",
      "c2f5",
      "g6f5"
    ],
    "solutionMoves": [
      "e6f5",
      "c2f5",
      "g6f5"
    ],
    "solutionSan": [
      "Bf5",
      "Qxf5",
      "gxf5"
    ],
    "playerColor": "black",
    "rating": 1622,
    "ratingDeviation": 76,
    "popularity": 99,
    "nbPlays": 2345,
    "difficulty": "intermediate",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/gVcbpusg#43",
    "openingTags": []
  },
  {
    "id": "00ZSd",
    "initialFen": "2R5/5pk1/pb4p1/1p1q4/3P1P1p/P3r2P/1PQ3P1/3R2K1 w - - 6 45",
    "puzzleFen": "2R5/5pk1/pb4p1/1p1q4/3P1P1p/P3r2P/1PQ3P1/3R3K b - - 7 45",
    "setupMove": "g1h1",
    "setupMoveSan": "Kh1",
    "moves": [
      "g1h1",
      "e3h3",
      "h1g1",
      "b6d4",
      "d1d4",
      "d5d4"
    ],
    "solutionMoves": [
      "e3h3",
      "h1g1",
      "b6d4",
      "d1d4",
      "d5d4"
    ],
    "solutionSan": [
      "Rxh3+",
      "Kg1",
      "Bxd4+",
      "Rxd4",
      "Qxd4+"
    ],
    "playerColor": "black",
    "rating": 1213,
    "ratingDeviation": 75,
    "popularity": 98,
    "nbPlays": 2919,
    "difficulty": "intermediate",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/D5o6GOOI#89",
    "openingTags": []
  },
  {
    "id": "00tB9",
    "initialFen": "1k1r3r/1bq1b1p1/p2p4/2nBp1P1/4P3/4BP2/1PPQN3/2KR3R w - - 3 24",
    "puzzleFen": "1k1r3r/1Bq1b1p1/p2p4/2n1p1P1/4P3/4BP2/1PPQN3/2KR3R b - - 0 24",
    "setupMove": "d5b7",
    "setupMoveSan": "Bxb7",
    "moves": [
      "d5b7",
      "c5b3",
      "c1b1",
      "b3d2"
    ],
    "solutionMoves": [
      "c5b3",
      "c1b1",
      "b3d2"
    ],
    "solutionSan": [
      "Nb3+",
      "Kb1",
      "Nxd2+"
    ],
    "playerColor": "black",
    "rating": 1219,
    "ratingDeviation": 77,
    "popularity": 97,
    "nbPlays": 5116,
    "difficulty": "intermediate",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/I1QFfgyS#47",
    "openingTags": []
  },
  {
    "id": "01FmQ",
    "initialFen": "3r2k1/2B3pp/1Q2Pp2/2b5/P3n3/5N2/2q2PPP/5RK1 w - - 4 32",
    "puzzleFen": "3r2k1/2B1P1pp/1Q3p2/2b5/P3n3/5N2/2q2PPP/5RK1 b - - 0 32",
    "setupMove": "e6e7",
    "setupMoveSan": "e7",
    "moves": [
      "e6e7",
      "c2f2",
      "f1f2",
      "d8d1",
      "f3e1",
      "d1e1"
    ],
    "solutionMoves": [
      "c2f2",
      "f1f2",
      "d8d1",
      "f3e1",
      "d1e1"
    ],
    "solutionSan": [
      "Qxf2+",
      "Rxf2",
      "Rd1+",
      "Ne1",
      "Rxe1#"
    ],
    "playerColor": "black",
    "rating": 1643,
    "ratingDeviation": 75,
    "popularity": 96,
    "nbPlays": 10983,
    "difficulty": "intermediate",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/e8I8ds3w#63",
    "openingTags": []
  },
  {
    "id": "010WS",
    "initialFen": "6k1/p2Q4/3p2p1/8/3qPn2/5P2/PPR3PP/6K1 w - - 2 37",
    "puzzleFen": "6k1/p2Q4/3p2p1/8/3qPn2/5P2/PP3RPP/6K1 b - - 3 37",
    "setupMove": "c2f2",
    "setupMoveSan": "Rf2",
    "moves": [
      "c2f2",
      "f4e2",
      "g1h1",
      "d4d1",
      "f2f1",
      "d1f1"
    ],
    "solutionMoves": [
      "f4e2",
      "g1h1",
      "d4d1",
      "f2f1",
      "d1f1"
    ],
    "solutionSan": [
      "Ne2+",
      "Kh1",
      "Qd1+",
      "Rf1",
      "Qxf1#"
    ],
    "playerColor": "black",
    "rating": 1995,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 1283,
    "difficulty": "advanced",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/WNpzh8ee#73",
    "openingTags": []
  },
  {
    "id": "01Qia",
    "initialFen": "1k4rr/pp3p2/b3p1q1/3p4/6R1/Q6P/PPP2PP1/4R1K1 b - - 4 27",
    "puzzleFen": "1k4rr/pp3p2/b3p3/3p4/6R1/Q6P/PPq2PP1/4R1K1 w - - 0 28",
    "setupMove": "g6c2",
    "setupMoveSan": "Qxc2",
    "moves": [
      "g6c2",
      "a3g3",
      "e6e5",
      "g4g8",
      "h8g8",
      "g3g8"
    ],
    "solutionMoves": [
      "a3g3",
      "e6e5",
      "g4g8",
      "h8g8",
      "g3g8"
    ],
    "solutionSan": [
      "Qg3+",
      "e5",
      "Rxg8+",
      "Rxg8",
      "Qxg8+"
    ],
    "playerColor": "white",
    "rating": 1857,
    "ratingDeviation": 74,
    "popularity": 96,
    "nbPlays": 4024,
    "difficulty": "advanced",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/JJboyzp6/black#54",
    "openingTags": []
  },
  {
    "id": "01Vce",
    "initialFen": "2r4r/6b1/8/1b1pPQ1k/2p2P2/4P3/PP1B3q/2K5 b - - 7 33",
    "puzzleFen": "2r4r/6b1/8/1b1pPQ2/2p2P1k/4P3/PP1B3q/2K5 w - - 8 34",
    "setupMove": "h5h4",
    "setupMoveSan": "Kh4",
    "moves": [
      "h5h4",
      "d2e1",
      "h2g3",
      "f5g5",
      "h4h3",
      "g5g3"
    ],
    "solutionMoves": [
      "d2e1",
      "h2g3",
      "f5g5",
      "h4h3",
      "g5g3"
    ],
    "solutionSan": [
      "Be1+",
      "Qg3",
      "Qg5+",
      "Kh3",
      "Qxg3#"
    ],
    "playerColor": "white",
    "rating": 2013,
    "ratingDeviation": 72,
    "popularity": 95,
    "nbPlays": 13347,
    "difficulty": "advanced",
    "primaryTheme": "pin",
    "themes": [
      "pin"
    ],
    "gameUrl": "https://lichess.org/game/90JQSZJo/black#66",
    "openingTags": []
  },
  {
    "id": "00WZO",
    "initialFen": "8/1R2B3/5p2/1k2bP1p/p6r/5K2/8/8 b - - 7 45",
    "puzzleFen": "8/1R2B3/5p2/4bP1p/p1k4r/5K2/8/8 w - - 8 46",
    "setupMove": "b5c4",
    "setupMoveSan": "Kc4",
    "moves": [
      "b5c4",
      "b7b4",
      "c4d5",
      "b4h4"
    ],
    "solutionMoves": [
      "b7b4",
      "c4d5",
      "b4h4"
    ],
    "solutionSan": [
      "Rb4+",
      "Kd5",
      "Rxh4"
    ],
    "playerColor": "white",
    "rating": 1127,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 844,
    "difficulty": "beginner",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/zw93HvDI/black#90",
    "openingTags": []
  },
  {
    "id": "01QSk",
    "initialFen": "6k1/7r/4P1p1/Q7/3P4/1r3K2/6P1/8 w - - 9 51",
    "puzzleFen": "6k1/7r/4P1p1/Q7/3PK3/1r6/6P1/8 b - - 10 51",
    "setupMove": "f3e4",
    "setupMoveSan": "Ke4",
    "moves": [
      "f3e4",
      "h7h4",
      "e4d5",
      "h4h5",
      "d5c4",
      "h5a5"
    ],
    "solutionMoves": [
      "h7h4",
      "e4d5",
      "h4h5",
      "d5c4",
      "h5a5"
    ],
    "solutionSan": [
      "Rh4+",
      "Kd5",
      "Rh5+",
      "Kc4",
      "Rxa5"
    ],
    "playerColor": "black",
    "rating": 1017,
    "ratingDeviation": 76,
    "popularity": 100,
    "nbPlays": 430,
    "difficulty": "beginner",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/CAhxmY2w#101",
    "openingTags": []
  },
  {
    "id": "01jvC",
    "initialFen": "8/pr6/3kp3/R2p1pp1/3P4/4PPP1/8/5K2 b - - 0 35",
    "puzzleFen": "8/p6r/3kp3/R2p1pp1/3P4/4PPP1/8/5K2 w - - 1 36",
    "setupMove": "b7h7",
    "setupMoveSan": "Rh7",
    "moves": [
      "b7h7",
      "a5a6",
      "d6e7",
      "a6a7",
      "e7f6",
      "a7h7"
    ],
    "solutionMoves": [
      "a5a6",
      "d6e7",
      "a6a7",
      "e7f6",
      "a7h7"
    ],
    "solutionSan": [
      "Ra6+",
      "Ke7",
      "Rxa7+",
      "Kf6",
      "Rxh7"
    ],
    "playerColor": "white",
    "rating": 911,
    "ratingDeviation": 78,
    "popularity": 100,
    "nbPlays": 274,
    "difficulty": "beginner",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/w4KHnK29/black#70",
    "openingTags": []
  },
  {
    "id": "00coU",
    "initialFen": "6k1/R7/5K2/1r6/5r2/p4N2/8/5R2 w - - 3 50",
    "puzzleFen": "6k1/R3K3/8/1r6/5r2/p4N2/8/5R2 b - - 4 50",
    "setupMove": "f6e7",
    "setupMoveSan": "Ke7",
    "moves": [
      "f6e7",
      "f4f7",
      "e7d6",
      "f7a7"
    ],
    "solutionMoves": [
      "f4f7",
      "e7d6",
      "f7a7"
    ],
    "solutionSan": [
      "Rf7+",
      "Kd6",
      "Rxa7"
    ],
    "playerColor": "black",
    "rating": 1552,
    "ratingDeviation": 78,
    "popularity": 100,
    "nbPlays": 1484,
    "difficulty": "intermediate",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/msAMDBoS#99",
    "openingTags": []
  },
  {
    "id": "004mT",
    "initialFen": "5Q2/8/1b1kp1p1/5p2/3p4/5qPK/7P/8 b - - 1 51",
    "puzzleFen": "5Q2/8/1bk1p1p1/5p2/3p4/5qPK/7P/8 w - - 2 52",
    "setupMove": "d6c6",
    "setupMoveSan": "Kc6",
    "moves": [
      "d6c6",
      "f8a8",
      "c6d6",
      "a8f3"
    ],
    "solutionMoves": [
      "f8a8",
      "c6d6",
      "a8f3"
    ],
    "solutionSan": [
      "Qa8+",
      "Kd6",
      "Qxf3"
    ],
    "playerColor": "white",
    "rating": 1291,
    "ratingDeviation": 75,
    "popularity": 98,
    "nbPlays": 9621,
    "difficulty": "intermediate",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/Jqhi4ozb/black#102",
    "openingTags": []
  },
  {
    "id": "03HYt",
    "initialFen": "3k4/3r4/6R1/4R2p/1p2P2P/pP1bPK2/r4NP1/8 w - - 0 42",
    "puzzleFen": "3k4/3r4/6R1/7R/1p2P2P/pP1bPK2/r4NP1/8 b - - 0 42",
    "setupMove": "e5h5",
    "setupMoveSan": "Rxh5",
    "moves": [
      "e5h5",
      "d3e2",
      "f3g3",
      "e2h5"
    ],
    "solutionMoves": [
      "d3e2",
      "f3g3",
      "e2h5"
    ],
    "solutionSan": [
      "Be2+",
      "Kg3",
      "Bxh5"
    ],
    "playerColor": "black",
    "rating": 1687,
    "ratingDeviation": 77,
    "popularity": 97,
    "nbPlays": 5731,
    "difficulty": "intermediate",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/dOcMLROR#83",
    "openingTags": []
  },
  {
    "id": "0BdVI",
    "initialFen": "3q1k2/5r2/5n1R/p1Q1pP2/4p3/2PP4/1r3P2/R3K3 b Q - 1 29",
    "puzzleFen": "5k2/4qr2/5n1R/p1Q1pP2/4p3/2PP4/1r3P2/R3K3 w Q - 2 30",
    "setupMove": "d8e7",
    "setupMoveSan": "Qe7",
    "moves": [
      "d8e7",
      "c5c8",
      "e7e8",
      "h6h8",
      "f8g7",
      "h8e8"
    ],
    "solutionMoves": [
      "c5c8",
      "e7e8",
      "h6h8",
      "f8g7",
      "h8e8"
    ],
    "solutionSan": [
      "Qc8+",
      "Qe8",
      "Rh8+",
      "Kg7",
      "Rxe8"
    ],
    "playerColor": "white",
    "rating": 2009,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 878,
    "difficulty": "advanced",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/UKiedRPX/black#58",
    "openingTags": []
  },
  {
    "id": "0AOHu",
    "initialFen": "8/6b1/1nq3kp/5p2/1pNp2pP/1PnP2P1/3QNP1K/2B5 b - - 5 36",
    "puzzleFen": "8/6b1/2q3kp/3n1p2/1pNp2pP/1PnP2P1/3QNP1K/2B5 w - - 6 37",
    "setupMove": "b6d5",
    "setupMoveSan": "Nbd5",
    "moves": [
      "b6d5",
      "c4e5",
      "g7e5",
      "d2h6",
      "g6f7",
      "h6c6"
    ],
    "solutionMoves": [
      "c4e5",
      "g7e5",
      "d2h6",
      "g6f7",
      "h6c6"
    ],
    "solutionSan": [
      "Ne5+",
      "Bxe5",
      "Qxh6+",
      "Kf7",
      "Qxc6"
    ],
    "playerColor": "white",
    "rating": 1853,
    "ratingDeviation": 76,
    "popularity": 98,
    "nbPlays": 2137,
    "difficulty": "advanced",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/47aSVI2R/black#72",
    "openingTags": []
  },
  {
    "id": "0E5pf",
    "initialFen": "2R1R3/3k2p1/1r3p1p/p2r1P2/1b1P3P/4B3/4K3/8 b - - 5 45",
    "puzzleFen": "2R1R3/3k2p1/2r2p1p/p2r1P2/1b1P3P/4B3/4K3/8 w - - 6 46",
    "setupMove": "b6c6",
    "setupMoveSan": "Rc6",
    "moves": [
      "b6c6",
      "c8d8",
      "d7c7",
      "d8d5"
    ],
    "solutionMoves": [
      "c8d8",
      "d7c7",
      "d8d5"
    ],
    "solutionSan": [
      "Rcd8+",
      "Kc7",
      "Rxd5"
    ],
    "playerColor": "white",
    "rating": 1959,
    "ratingDeviation": 75,
    "popularity": 97,
    "nbPlays": 1593,
    "difficulty": "advanced",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/PSeFzkjE/black#90",
    "openingTags": []
  },
  {
    "id": "04Kar",
    "initialFen": "2r3k1/5p1p/1qP1p1p1/3pP3/Pr3P2/R1Q4P/6P1/2R3K1 w - - 3 27",
    "puzzleFen": "2r3k1/5p1p/1qP1p1p1/2QpP3/Pr3P2/R6P/6P1/2R3K1 b - - 4 27",
    "setupMove": "c3c5",
    "setupMoveSan": "Qc5",
    "moves": [
      "c3c5",
      "c8c6",
      "c5b6",
      "c6c1"
    ],
    "solutionMoves": [
      "c8c6",
      "c5b6",
      "c6c1"
    ],
    "solutionSan": [
      "Rxc6",
      "Qxb6",
      "Rxc1+"
    ],
    "playerColor": "black",
    "rating": 1855,
    "ratingDeviation": 75,
    "popularity": 96,
    "nbPlays": 4483,
    "difficulty": "advanced",
    "primaryTheme": "skewer",
    "themes": [
      "skewer"
    ],
    "gameUrl": "https://lichess.org/game/U97ofx5d#53",
    "openingTags": []
  },
  {
    "id": "00yIS",
    "initialFen": "3r3k/p5p1/5q1p/8/P1b5/4Q1RP/6BK/8 b - - 6 42",
    "puzzleFen": "7k/p5p1/5q1p/8/P1b5/3rQ1RP/6BK/8 w - - 7 43",
    "setupMove": "d8d3",
    "setupMoveSan": "Rd3",
    "moves": [
      "d8d3",
      "e3e8",
      "c4g8",
      "g3d3"
    ],
    "solutionMoves": [
      "e3e8",
      "c4g8",
      "g3d3"
    ],
    "solutionSan": [
      "Qe8+",
      "Bg8",
      "Rxd3"
    ],
    "playerColor": "white",
    "rating": 1047,
    "ratingDeviation": 78,
    "popularity": 100,
    "nbPlays": 861,
    "difficulty": "beginner",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/fIQfIXST/black#84",
    "openingTags": []
  },
  {
    "id": "00R2A",
    "initialFen": "2kr1b1R/p5p1/8/3P1p2/8/4B3/PPPK1P2/8 w - - 1 25",
    "puzzleFen": "2kr1b1R/p5p1/8/3P1p2/2P5/4B3/PP1K1P2/8 b - c3 0 25",
    "setupMove": "c2c4",
    "setupMoveSan": "c4",
    "moves": [
      "c2c4",
      "f8b4",
      "d2d3",
      "d8h8"
    ],
    "solutionMoves": [
      "f8b4",
      "d2d3",
      "d8h8"
    ],
    "solutionSan": [
      "Bb4+",
      "Kd3",
      "Rxh8"
    ],
    "playerColor": "black",
    "rating": 909,
    "ratingDeviation": 77,
    "popularity": 99,
    "nbPlays": 1659,
    "difficulty": "beginner",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/ZjzT3REI#49",
    "openingTags": []
  },
  {
    "id": "00mvr",
    "initialFen": "7r/ppp1Nk1p/2n5/8/8/2P2pP1/P6P/R1Br1BK1 b - - 0 20",
    "puzzleFen": "7r/ppp1k2p/2n5/8/8/2P2pP1/P6P/R1Br1BK1 w - - 0 21",
    "setupMove": "f7e7",
    "setupMoveSan": "Kxe7",
    "moves": [
      "f7e7",
      "c1g5",
      "e7e6",
      "a1d1"
    ],
    "solutionMoves": [
      "c1g5",
      "e7e6",
      "a1d1"
    ],
    "solutionSan": [
      "Bg5+",
      "Ke6",
      "Rxd1"
    ],
    "playerColor": "white",
    "rating": 768,
    "ratingDeviation": 84,
    "popularity": 99,
    "nbPlays": 1424,
    "difficulty": "beginner",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/R3FdESiy/black#40",
    "openingTags": []
  },
  {
    "id": "01Ni2",
    "initialFen": "2k2r2/1bNp4/pB1P4/8/P7/4Kn2/1P3R1p/5R2 w - - 0 43",
    "puzzleFen": "2k2r2/1bNp4/pB1P4/8/P7/5n2/1P2KR1p/5R2 b - - 1 43",
    "setupMove": "e3e2",
    "setupMoveSan": "Ke2",
    "moves": [
      "e3e2",
      "f3g1",
      "e2d2",
      "f8f2",
      "b6f2",
      "h2h1q"
    ],
    "solutionMoves": [
      "f3g1",
      "e2d2",
      "f8f2",
      "b6f2",
      "h2h1q"
    ],
    "solutionSan": [
      "Ng1+",
      "Kd2",
      "Rxf2+",
      "Bxf2",
      "h1=Q"
    ],
    "playerColor": "black",
    "rating": 1768,
    "ratingDeviation": 74,
    "popularity": 89,
    "nbPlays": 1338,
    "difficulty": "intermediate",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/f1qBEzxV#85",
    "openingTags": []
  },
  {
    "id": "00f1Y",
    "initialFen": "1r6/p2n1pkp/4p1p1/2Np4/1r6/1P1K1P1P/P3R1P1/2R5 b - - 5 36",
    "puzzleFen": "2r5/p2n1pkp/4p1p1/2Np4/1r6/1P1K1P1P/P3R1P1/2R5 w - - 6 37",
    "setupMove": "b8c8",
    "setupMoveSan": "Rc8",
    "moves": [
      "b8c8",
      "c5e6",
      "f7e6",
      "c1c8"
    ],
    "solutionMoves": [
      "c5e6",
      "f7e6",
      "c1c8"
    ],
    "solutionSan": [
      "Nxe6+",
      "fxe6",
      "Rxc8"
    ],
    "playerColor": "white",
    "rating": 1252,
    "ratingDeviation": 75,
    "popularity": 100,
    "nbPlays": 712,
    "difficulty": "intermediate",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/5k1h2DTZ/black#72",
    "openingTags": []
  },
  {
    "id": "00AFG",
    "initialFen": "r4rk1/2q2ppp/p3bp2/2P2N1Q/Ppp5/8/1PP2PPP/R2R2K1 b - - 6 21",
    "puzzleFen": "r4rk1/5ppp/p3bp2/2q2N1Q/Ppp5/8/1PP2PPP/R2R2K1 w - - 0 22",
    "setupMove": "c7c5",
    "setupMoveSan": "Qxc5",
    "moves": [
      "c7c5",
      "f5h6",
      "g7h6",
      "h5c5"
    ],
    "solutionMoves": [
      "f5h6",
      "g7h6",
      "h5c5"
    ],
    "solutionSan": [
      "Nh6+",
      "gxh6",
      "Qxc5"
    ],
    "playerColor": "white",
    "rating": 1492,
    "ratingDeviation": 76,
    "popularity": 99,
    "nbPlays": 2221,
    "difficulty": "intermediate",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/xpx24bwV/black#42",
    "openingTags": []
  },
  {
    "id": "03Oqv",
    "initialFen": "r2qkn1R/p4pp1/2n1p3/1N1p2P1/1ppPPN2/5P2/PPPQ4/2K5 b q - 0 19",
    "puzzleFen": "r3kn1R/p4pp1/2n1p3/1N1p2q1/1ppPPN2/5P2/PPPQ4/2K5 w q - 0 20",
    "setupMove": "d8g5",
    "setupMoveSan": "Qxg5",
    "moves": [
      "d8g5",
      "h8f8",
      "e8f8",
      "f4e6",
      "f7e6",
      "d2g5"
    ],
    "solutionMoves": [
      "h8f8",
      "e8f8",
      "f4e6",
      "f7e6",
      "d2g5"
    ],
    "solutionSan": [
      "Rxf8+",
      "Kxf8",
      "Nxe6+",
      "fxe6",
      "Qxg5"
    ],
    "playerColor": "white",
    "rating": 1904,
    "ratingDeviation": 77,
    "popularity": 95,
    "nbPlays": 12835,
    "difficulty": "advanced",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/oYj5Qz1x/black#38",
    "openingTags": [
      "Rapport-Jobava_System",
      "Rapport-Jobava_System_Other_variations"
    ]
  },
  {
    "id": "00vUf",
    "initialFen": "3R4/p4pkp/2p5/6p1/1P1B4/r3PP2/2r3PP/5K2 b - - 6 31",
    "puzzleFen": "3R4/p4p1p/2p3k1/6p1/1P1B4/r3PP2/2r3PP/5K2 w - - 7 32",
    "setupMove": "g7g6",
    "setupMoveSan": "Kg6",
    "moves": [
      "g7g6",
      "d8d6",
      "f7f6",
      "d6f6",
      "g6g7",
      "f6c6"
    ],
    "solutionMoves": [
      "d8d6",
      "f7f6",
      "d6f6",
      "g6g7",
      "f6c6"
    ],
    "solutionSan": [
      "Rd6+",
      "f6",
      "Rxf6+",
      "Kg7",
      "Rxc6+"
    ],
    "playerColor": "white",
    "rating": 2159,
    "ratingDeviation": 76,
    "popularity": 95,
    "nbPlays": 2617,
    "difficulty": "advanced",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/87kUHyPW/black#62",
    "openingTags": []
  },
  {
    "id": "02kn2",
    "initialFen": "rnbqk2r/pp3pp1/3bpn1p/1B1pN3/3Q1B2/4P3/PPP2PPP/RN2K2R b KQkq - 2 8",
    "puzzleFen": "rn1qk2r/pp1b1pp1/3bpn1p/1B1pN3/3Q1B2/4P3/PPP2PPP/RN2K2R w KQkq - 3 9",
    "setupMove": "c8d7",
    "setupMoveSan": "Bd7",
    "moves": [
      "c8d7",
      "e5d7",
      "b8d7",
      "f4d6"
    ],
    "solutionMoves": [
      "e5d7",
      "b8d7",
      "f4d6"
    ],
    "solutionSan": [
      "Nxd7",
      "Nbxd7",
      "Bxd6"
    ],
    "playerColor": "white",
    "rating": 1848,
    "ratingDeviation": 75,
    "popularity": 94,
    "nbPlays": 9639,
    "difficulty": "advanced",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/OrurLtEu/black#16",
    "openingTags": [
      "Torre_Attack",
      "Torre_Attack_Classical_Defense"
    ]
  },
  {
    "id": "00dqP",
    "initialFen": "r1b2rk1/5p1p/p3pP2/1p1p4/5q1n/1P5P/P1P1QPB1/1K1R2R1 b - - 2 21",
    "puzzleFen": "r1b2rk1/5p1p/p3pq2/1p1p4/7n/1P5P/P1P1QPB1/1K1R2R1 w - - 0 22",
    "setupMove": "f4f6",
    "setupMoveSan": "Qxf6",
    "moves": [
      "f4f6",
      "g2d5",
      "h4g6",
      "d5a8"
    ],
    "solutionMoves": [
      "g2d5",
      "h4g6",
      "d5a8"
    ],
    "solutionSan": [
      "Bxd5+",
      "Ng6",
      "Bxa8"
    ],
    "playerColor": "white",
    "rating": 1848,
    "ratingDeviation": 74,
    "popularity": 94,
    "nbPlays": 7019,
    "difficulty": "advanced",
    "primaryTheme": "discoveredAttack",
    "themes": [
      "discoveredAttack"
    ],
    "gameUrl": "https://lichess.org/game/6NRhzen2/black#42",
    "openingTags": []
  }
];

export function getAllPuzzles() {
  return PUZZLES_DATA;
}

export function getPuzzleById(puzzleId) {
  if (!puzzleId || typeof puzzleId !== 'string') return null;
  return PUZZLES_DATA.find(p => p.id === puzzleId.trim()) || null;
}

export function getPuzzleCategoryById(themeId) {
  return PUZZLE_CATEGORIES.find(c => c.id === themeId) || null;
}

export function getPuzzleDifficultyById(difficultyId) {
  return PUZZLE_DIFFICULTIES.find(d => d.id === difficultyId) || null;
}

/**
 * Mengambil hanya kategori yang benar-benar memiliki data puzzle (Bagian 3)
 */
export function getAvailablePuzzleCategories() {
  return PUZZLE_CATEGORIES.filter(cat =>
    PUZZLES_DATA.some(p => p.primaryTheme === cat.id || (Array.isArray(p.themes) && p.themes.includes(cat.id)))
  );
}

/**
 * Menyaring daftar puzzle berdasarkan tema dan/atau tingkat kesulitan
 */
export function getPuzzlesByFilter({ theme = 'all', difficulty = 'all' } = {}) {
  return PUZZLES_DATA.filter(puzzle => {
    const matchTheme =
      !theme ||
      theme === 'all' ||
      puzzle.primaryTheme === theme ||
      (Array.isArray(puzzle.themes) && puzzle.themes.includes(theme));
    const matchDiff =
      !difficulty || difficulty === 'all' || puzzle.difficulty === difficulty;
    return matchTheme && matchDiff;
  });
}

/**
 * Menghasilkan urutan deterministik puzzle harian agar bervariasi antar tema dan kesulitan
 */
function getDailyRotationPool() {
  const byTheme = new Map();
  for (const cat of PUZZLE_CATEGORIES) {
    byTheme.set(
      cat.id,
      PUZZLES_DATA.filter(p => p.primaryTheme === cat.id)
    );
  }
  const interleaved = [];
  const maxLen = Math.max(...Array.from(byTheme.values()).map(arr => arr.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const cat of PUZZLE_CATEGORIES) {
      const list = byTheme.get(cat.id) || [];
      if (i < list.length) {
        interleaved.push(list[i]);
      }
    }
  }
  return interleaved.length > 0 ? interleaved : PUZZLES_DATA;
}

/**
 * Pemilihan Puzzle Harian secara deterministik berdasarkan tanggal lokal 'YYYY-MM-DD'.
 * Kedua perangkat pada tanggal lokal yang sama dijamin mendapatkan puzzle harian yang sama persis.
 */
export function getDailyPuzzle(dateStr) {
  const pool = getDailyRotationPool();
  if (pool.length === 0) return null;

  let targetDate = dateStr;
  if (typeof targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    targetDate = `${y}-${m}-${d}`;
  } else {
    targetDate = targetDate.trim();
  }

  const [year, month, day] = targetDate.split('-').map(Number);
  const epochDays = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const index = ((epochDays % pool.length) + pool.length) % pool.length;
  return pool[index];
}

/**
 * Memilih puzzle berikutnya dalam satu pool latihan tanpa mengulangi puzzle yang sama
 * sebelum seluruh pool habis (Bagian 9).
 */
export function selectNextPuzzle({
  theme = 'all',
  difficulty = 'all',
  solvedPuzzleIds = [],
  sessionPlayedIds = [],
  currentPuzzleId = null
} = {}) {
  const pool = getPuzzlesByFilter({ theme, difficulty });
  if (pool.length === 0) {
    return { puzzle: null, updatedSessionPlayedIds: [], poolReset: false };
  }

  const playedSet = new Set(sessionPlayedIds);
  if (currentPuzzleId) {
    playedSet.add(currentPuzzleId);
  }

  const solvedSet = new Set(solvedPuzzleIds);

  // Cari puzzle di dalam pool yang belum dimainkan pada siklus sesi ini
  let candidates = pool.filter(p => !playedSet.has(p.id));
  let poolReset = false;

  if (candidates.length === 0) {
    // Seluruh puzzle di dalam pool sudah dimainkan -> mulai siklus baru
    poolReset = true;
    playedSet.clear();
    if (currentPuzzleId && pool.length > 1) {
      playedSet.add(currentPuzzleId);
      candidates = pool.filter(p => p.id !== currentPuzzleId);
    } else {
      candidates = [...pool];
    }
  }

  // Prioritaskan puzzle yang belum pernah diselesaikan pengguna jika masih tersedia di kandidat
  const unsolvedCandidates = candidates.filter(p => !solvedSet.has(p.id));
  const nextPuzzle =
    unsolvedCandidates.length > 0 ? unsolvedCandidates[0] : candidates[0];

  if (nextPuzzle) {
    playedSet.add(nextPuzzle.id);
  }

  return {
    puzzle: nextPuzzle || null,
    updatedSessionPlayedIds: Array.from(playedSet),
    poolReset
  };
}
