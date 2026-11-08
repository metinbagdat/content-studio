import type { PrereqNodeInput } from './prereqGraph'
import { PREREQ_GRAPH_SLUG } from './prereqGraph'

/**
 * Full TYT Matematik prerequisite graph + AYT Logaritma → Üstel example.
 * Topic codes align with LearnCon `topics.code` (007b) where present;
 * AYT örnek uses curriculum_tree learning_outcome_code (206 seed).
 */
export const TYT_MATH_PREREQ_NODES: PrereqNodeInput[] = [
  // —— Sayılar ——
  {
    code: 'tyt_mat_dogal_sayilar',
    label: 'Doğal Sayılar',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: [],
  },
  {
    code: 'tyt_mat_tam_sayilar',
    label: 'Tam Sayılar',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: ['tyt_mat_dogal_sayilar'],
  },
  {
    code: 'tyt_mat_rasyonel',
    label: 'Rasyonel Sayılar',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: ['tyt_mat_tam_sayilar'],
  },
  {
    code: 'tyt_mat_sayi_basamak',
    label: 'Sayı Basamakları',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: ['tyt_mat_dogal_sayilar'],
  },
  {
    code: 'tyt_mat_bolme',
    label: 'Bölme ve Bölünebilme',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: ['tyt_mat_tam_sayilar'],
  },
  {
    code: 'tyt_mat_ebob_ekok',
    label: 'EBOB – EKOK',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: ['tyt_mat_bolme'],
  },
  {
    code: 'tyt_mat_uslu_koklu',
    label: 'Üslü ve Köklü Sayılar',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayılar',
    prerequisites: ['tyt_mat_rasyonel'],
  },
  // —— Cebir ——
  {
    code: 'tyt_mat_denklemler',
    label: 'Denklemler',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Cebir',
    prerequisites: ['tyt_mat_rasyonel', 'tyt_mat_sayi_basamak'],
  },
  {
    code: 'tyt_mat_esitsizlikler',
    label: 'Eşitsizlikler',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Cebir',
    prerequisites: ['tyt_mat_denklemler'],
  },
  {
    code: 'tyt_mat_mutlak_deger',
    label: 'Mutlak Değer',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Cebir',
    prerequisites: ['tyt_mat_tam_sayilar'],
  },
  {
    code: 'tyt_mat_fonksiyonlar',
    label: 'Fonksiyonlar',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Cebir',
    prerequisites: ['tyt_mat_esitsizlikler', 'tyt_mat_uslu_koklu'],
  },
  // —— Geometri ——
  {
    code: 'tyt_mat_alan_cevre',
    label: 'Alan ve Çevre',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Geometri',
    prerequisites: ['tyt_mat_rasyonel'],
  },
  {
    code: 'tyt_mat_ucgenler',
    label: 'Üçgenler',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Geometri',
    prerequisites: ['tyt_mat_alan_cevre'],
  },
  {
    code: 'tyt_mat_dortgenler',
    label: 'Dörtgenler',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Geometri',
    prerequisites: ['tyt_mat_ucgenler'],
  },
  {
    code: 'tyt_mat_cemberler',
    label: 'Çemberler',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Geometri',
    prerequisites: ['tyt_mat_ucgenler'],
  },
  // —— Veri / olasılık / sayma ——
  {
    code: 'tyt_mat_istatistik',
    label: 'İstatistik',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Veri Analizi',
    prerequisites: ['tyt_mat_rasyonel'],
  },
  {
    code: 'tyt_mat_olasilik',
    label: 'Temel Olasılık',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Olasılık',
    prerequisites: ['tyt_mat_rasyonel', 'tyt_mat_bolme'],
  },
  {
    code: 'tyt_mat_permutasyon',
    label: 'Permütasyon – Kombinasyon',
    examType: 'TYT',
    subject: 'Matematik',
    unit: 'Sayma',
    prerequisites: ['tyt_mat_olasilik'],
  },
  // —— AYT “vay be” örneği: Logaritma → Üstel (Üslü) ——
  {
    code: '12.1.1.1.',
    label: 'Üstel Fonksiyon',
    examType: 'AYT',
    subject: 'Matematik',
    unit: 'Üstel Fonksiyon',
    prerequisites: ['tyt_mat_uslu_koklu'],
  },
  {
    code: '12.1.2.1.',
    label: 'Logaritma Fonksiyonu',
    examType: 'AYT',
    subject: 'Matematik',
    unit: 'Logaritma Fonksiyonu',
    prerequisites: ['12.1.1.1.'],
  },
]

export const TYT_MATH_PREREQ_GRAPH = {
  slug: PREREQ_GRAPH_SLUG,
  title: 'TYT Matematik önkoşul grafiği (+ AYT logaritma→üstel)',
  nodes: TYT_MATH_PREREQ_NODES,
}
