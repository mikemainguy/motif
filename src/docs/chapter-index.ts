export interface ChapterInfo {
  id: string;
  filename: string;
  title: string;
}

export const CHAPTERS: ChapterInfo[] = [
  { id: '01', filename: '01_Introduction.txt', title: 'Introduction' },
  { id: '02', filename: '02_ApplicationIndex.txt', title: 'Application Index' },
  { id: '03', filename: '03_Contents.txt', title: 'Contents' },
  { id: '04', filename: '04_TheControls.txt', title: 'The Controls' },
  { id: '05', filename: '05_SettingUp.txt', title: 'Setting Up' },
  { id: '06', filename: '06_BasicOperation.txt', title: 'Basic Operation' },
  { id: '07', filename: '07_QuickGuide_Playing.txt', title: 'Quick Guide - Playing' },
  { id: '08', filename: '08_QuickGuide_Advanced_1.txt', title: 'Quick Guide - Advanced 1' },
  { id: '09', filename: '09_QuickGuide_Advanced_2.txt', title: 'Quick Guide - Advanced 2' },
  { id: '10', filename: '10_QuickGuide_Computer.txt', title: 'Quick Guide - Computer' },
  { id: '11', filename: '11_BasicStructure.txt', title: 'Basic Structure' },
  { id: '12', filename: '12_ref_Voicemode.txt', title: 'Reference - Voice Mode' },
  { id: '13', filename: '13_ref_Performancemode.txt', title: 'Reference - Performance Mode' },
  { id: '14', filename: '14_ref_Songmode.txt', title: 'Reference - Song Mode' },
  { id: '15', filename: '15_ref_Patternmode.txt', title: 'Reference - Pattern Mode' },
  { id: '16', filename: '16_ref_MixingVoicemode.txt', title: 'Reference - Mixing Voice Mode' },
  { id: '17', filename: '17_ref_Samplingmode.txt', title: 'Reference - Sampling Mode' },
  { id: '18', filename: '18_ref_Utilitymode.txt', title: 'Reference - Utility Mode' },
  { id: '19', filename: '19_ref_Filemode.txt', title: 'Reference - File Mode' },
  { id: '20', filename: '20_ref_Mastermode.txt', title: 'Reference - Master Mode' },
  { id: '21', filename: '21_InformationDisplays.txt', title: 'Information Displays' },
  { id: '22', filename: '22_Troubleshooting.txt', title: 'Troubleshooting' },
  { id: '23', filename: '23_InstallingOptional.txt', title: 'Installing Optional Hardware' },
  { id: '24', filename: '24_Glossary.txt', title: 'Glossary' },
  { id: '25', filename: '25_Specifications.txt', title: 'Specifications' },
  { id: '26', filename: '26_DataList.txt', title: 'Data List' },
];

export function findChapter(idOrName: string): ChapterInfo | undefined {
  const normalized = idOrName.toLowerCase().trim();

  // Try exact ID match first
  const byId = CHAPTERS.find((c) => c.id === normalized.padStart(2, '0'));
  if (byId) return byId;

  // Try title match (case-insensitive, partial)
  return CHAPTERS.find((c) => c.title.toLowerCase().includes(normalized));
}
