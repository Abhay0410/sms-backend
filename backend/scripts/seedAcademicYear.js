// scripts/seedAcademicYear.js
export const classSubjects = {
  Nursery: [
    { name: 'English', code: 'ENGN', hasPractical: false },
    { name: 'Hindi', code: 'HINN', hasPractical: false },
    { name: 'Mathematics', code: 'MATN', hasPractical: false },
    { name: 'General Awareness', code: 'GAN', hasPractical: false },
    { name: 'Art & Craft', code: 'ARTN', hasPractical: true },
    { name: 'Physical Activity', code: 'PEN', hasPractical: true }
  ],
  LKG: [
    { name: 'English', code: 'ENGLKG', hasPractical: false },
    { name: 'Hindi', code: 'HINLKG', hasPractical: false },
    { name: 'Mathematics', code: 'MATLKG', hasPractical: false },
    { name: 'General Awareness', code: 'GALKG', hasPractical: false },
    { name: 'Art & Craft', code: 'ARTLKG', hasPractical: true },
    { name: 'Physical Activity', code: 'PELKG', hasPractical: true }
  ],
  UKG: [
    { name: 'English', code: 'ENGUKG', hasPractical: false },
    { name: 'Hindi', code: 'HINUKG', hasPractical: false },
    { name: 'Mathematics', code: 'MATUKG', hasPractical: false },
    { name: 'General Awareness', code: 'GAUKG', hasPractical: false },
    { name: 'Art & Craft', code: 'ARTUKG', hasPractical: true },
    { name: 'Physical Activity', code: 'PEUKG', hasPractical: true }
  ],
  '1': [
    { name: 'English', code: 'ENG1', hasPractical: false },
    { name: 'Hindi', code: 'HIN1', hasPractical: false },
    { name: 'Mathematics', code: 'MAT1', hasPractical: false },
    { name: 'Environmental Studies', code: 'EVS1', hasPractical: false },
    { name: 'General Knowledge', code: 'GK1', hasPractical: false },
    { name: 'Art & Craft', code: 'ART1', hasPractical: true },
    { name: 'Physical Education', code: 'PE1', hasPractical: true }
  ],
  '2': [
    { name: 'English', code: 'ENG2', hasPractical: false },
    { name: 'Hindi', code: 'HIN2', hasPractical: false },
    { name: 'Mathematics', code: 'MAT2', hasPractical: false },
    { name: 'Environmental Studies', code: 'EVS2', hasPractical: false },
    { name: 'General Knowledge', code: 'GK2', hasPractical: false },
    { name: 'Art & Craft', code: 'ART2', hasPractical: true },
    { name: 'Physical Education', code: 'PE2', hasPractical: true }
  ],
  '3': [
    { name: 'English', code: 'ENG3', hasPractical: false },
    { name: 'Hindi', code: 'HIN3', hasPractical: false },
    { name: 'Mathematics', code: 'MAT3', hasPractical: false },
    { name: 'Environmental Studies', code: 'EVS3', hasPractical: false },
    { name: 'General Knowledge', code: 'GK3', hasPractical: false },
    { name: 'Computer Science', code: 'CS3', hasPractical: true },
    { name: 'Art & Craft', code: 'ART3', hasPractical: true },
    { name: 'Physical Education', code: 'PE3', hasPractical: true }
  ],
  '4': [
    { name: 'English', code: 'ENG4', hasPractical: false },
    { name: 'Hindi', code: 'HIN4', hasPractical: false },
    { name: 'Mathematics', code: 'MAT4', hasPractical: false },
    { name: 'Environmental Studies', code: 'EVS4', hasPractical: false },
    { name: 'General Knowledge', code: 'GK4', hasPractical: false },
    { name: 'Computer Science', code: 'CS4', hasPractical: true },
    { name: 'Art & Craft', code: 'ART4', hasPractical: true },
    { name: 'Physical Education', code: 'PE4', hasPractical: true }
  ],
  '5': [
    { name: 'English', code: 'ENG5', hasPractical: false },
    { name: 'Hindi', code: 'HIN5', hasPractical: false },
    { name: 'Mathematics', code: 'MAT5', hasPractical: false },
    { name: 'Science', code: 'SCI5', hasPractical: true },
    { name: 'Social Studies', code: 'SS5', hasPractical: false },
    { name: 'Computer Science', code: 'CS5', hasPractical: true },
    { name: 'Art & Craft', code: 'ART5', hasPractical: true },
    { name: 'Physical Education', code: 'PE5', hasPractical: true }
  ],
  '6': [
    { name: 'English', code: 'ENG6', hasPractical: false },
    { name: 'Hindi', code: 'HIN6', hasPractical: false },
    { name: 'Mathematics', code: 'MAT6', hasPractical: false },
    { name: 'Science', code: 'SCI6', hasPractical: true },
    { name: 'Social Studies', code: 'SS6', hasPractical: false },
    { name: 'Computer Science', code: 'CS6', hasPractical: true },
    { name: 'Sanskrit', code: 'SAN6', hasPractical: false },
    { name: 'Art & Craft', code: 'ART6', hasPractical: true },
    { name: 'Physical Education', code: 'PE6', hasPractical: true }
  ],
  '7': [
    { name: 'English', code: 'ENG7', hasPractical: false },
    { name: 'Hindi', code: 'HIN7', hasPractical: false },
    { name: 'Mathematics', code: 'MAT7', hasPractical: false },
    { name: 'Science', code: 'SCI7', hasPractical: true },
    { name: 'Social Studies', code: 'SS7', hasPractical: false },
    { name: 'Computer Science', code: 'CS7', hasPractical: true },
    { name: 'Sanskrit', code: 'SAN7', hasPractical: false },
    { name: 'Art & Craft', code: 'ART7', hasPractical: true },
    { name: 'Physical Education', code: 'PE7', hasPractical: true }
  ],
  '8': [
    { name: 'English', code: 'ENG8', hasPractical: false },
    { name: 'Hindi', code: 'HIN8', hasPractical: false },
    { name: 'Mathematics', code: 'MAT8', hasPractical: false },
    { name: 'Science', code: 'SCI8', hasPractical: true },
    { name: 'Social Studies', code: 'SS8', hasPractical: false },
    { name: 'Computer Science', code: 'CS8', hasPractical: true },
    { name: 'Sanskrit', code: 'SAN8', hasPractical: false },
    { name: 'Art & Craft', code: 'ART8', hasPractical: true },
    { name: 'Physical Education', code: 'PE8', hasPractical: true }
  ],
  '9': [
    { name: 'English', code: 'ENG9', hasPractical: false },
    { name: 'Hindi', code: 'HIN9', hasPractical: false },
    { name: 'Mathematics', code: 'MAT9', hasPractical: false },
    { name: 'Science', code: 'SCI9', hasPractical: true },
    { name: 'Social Studies', code: 'SS9', hasPractical: false },
    { name: 'Computer Science', code: 'CS9', hasPractical: true },
    { name: 'Sanskrit', code: 'SAN9', hasPractical: false },
    { name: 'Physical Education', code: 'PE9', hasPractical: true }
  ],
  '10': [
    { name: 'English', code: 'ENG10', hasPractical: false },
    { name: 'Hindi', code: 'HIN10', hasPractical: false },
    { name: 'Mathematics', code: 'MAT10', hasPractical: false },
    { name: 'Science', code: 'SCI10', hasPractical: true },
    { name: 'Social Studies', code: 'SS10', hasPractical: false },
    { name: 'Computer Science', code: 'CS10', hasPractical: true },
    { name: 'Sanskrit', code: 'SAN10', hasPractical: false },
    { name: 'Physical Education', code: 'PE10', hasPractical: true }
  ],
};

export const class11Streams = {
  Science: [
    { name: 'English', code: 'ENG11S', hasPractical: false },
    { name: 'Physics', code: 'PHY11', hasPractical: true },
    { name: 'Chemistry', code: 'CHE11', hasPractical: true },
    { name: 'Mathematics', code: 'MAT11S', hasPractical: false },
    { name: 'Biology', code: 'BIO11', hasPractical: true },
    { name: 'Computer Science', code: 'CS11', hasPractical: true },
    { name: 'Physical Education', code: 'PE11', hasPractical: true }
  ],
  Commerce: [
    { name: 'English', code: 'ENG11C', hasPractical: false },
    { name: 'Accountancy', code: 'ACC11', hasPractical: false },
    { name: 'Business Studies', code: 'BS11', hasPractical: false },
    { name: 'Economics', code: 'ECO11', hasPractical: false },
    { name: 'Mathematics', code: 'MAT11C', hasPractical: false },
    { name: 'Informatics Practices', code: 'IP11', hasPractical: true },
    { name: 'Physical Education', code: 'PE11C', hasPractical: true }
  ],
  Arts: [
    { name: 'English', code: 'ENG11A', hasPractical: false },
    { name: 'History', code: 'HIS11', hasPractical: false },
    { name: 'Political Science', code: 'PS11', hasPractical: false },
    { name: 'Geography', code: 'GEO11', hasPractical: false },
    { name: 'Economics', code: 'ECO11A', hasPractical: false },
    { name: 'Psychology', code: 'PSY11', hasPractical: false },
    { name: 'Physical Education', code: 'PE11A', hasPractical: true }
  ]
};

export const class12Streams = {
  Science: [
    { name: 'English', code: 'ENG12S', hasPractical: false },
    { name: 'Physics', code: 'PHY12', hasPractical: true },
    { name: 'Chemistry', code: 'CHE12', hasPractical: true },
    { name: 'Mathematics', code: 'MAT12S', hasPractical: false },
    { name: 'Biology', code: 'BIO12', hasPractical: true },
    { name: 'Computer Science', code: 'CS12', hasPractical: true },
    { name: 'Physical Education', code: 'PE12', hasPractical: true }
  ],
  Commerce: [
    { name: 'English', code: 'ENG12C', hasPractical: false },
    { name: 'Accountancy', code: 'ACC12', hasPractical: false },
    { name: 'Business Studies', code: 'BS12', hasPractical: false },
    { name: 'Economics', code: 'ECO12', hasPractical: false },
    { name: 'Mathematics', code: 'MAT12C', hasPractical: false },
    { name: 'Informatics Practices', code: 'IP12', hasPractical: true },
    { name: 'Physical Education', code: 'PE12C', hasPractical: true }
  ],
  Arts: [
    { name: 'English', code: 'ENG12A', hasPractical: false },
    { name: 'History', code: 'HIS12', hasPractical: false },
    { name: 'Political Science', code: 'PS12', hasPractical: false },
    { name: 'Geography', code: 'GEO12', hasPractical: false },
    { name: 'Economics', code: 'ECO12A', hasPractical: false },
    { name: 'Psychology', code: 'PSY12', hasPractical: false },
    { name: 'Physical Education', code: 'PE12A', hasPractical: true }
  ]
};
