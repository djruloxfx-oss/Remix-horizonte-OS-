export type AIProviderKey =
  | 'general'
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'perplexity'
  | 'grok';

export type SuperAgentMode = 'modo1' | 'modo2' | 'modo3';

export type MissionPriority =
  | 'Imprescindible'
  | 'Alta'
  | 'Importante'
  | 'Media'
  | 'Conveniente'
  | 'Prescindible';

export type MissionStatus =
  | 'Nueva'
  | 'Analizando'
  | 'Ejecutando'
  | 'Verificando'
  | 'Activa'
  | 'En riesgo'
  | 'Bloqueada'
  | 'Pausada'
  | 'Completada'
  | 'Cancelada';

export interface Mission {
  id: string;
  titulo: string;
  categoria?: string;
  objetivo: string;
  resultado?: string;
  contexto: string;
  restricciones: string;
  criterios: string;
  prioridad: MissionPriority;
  estado: MissionStatus;
  planA: string;
  planB: string;
  riesgo: string;
  siguiente: string;
  pasos?: string[];
  agentes?: string[];
  telefono?: string;
  actualizada: string;
}

export type EisenhowerQuadrant = 'hacer' | 'planificar' | 'delegar' | 'eliminar';

export interface TaskItem {
  id: string;
  titulo: string;
  quadrant: EisenhowerQuadrant;
  done: boolean;
  energyCost: 'bajo' | 'medio' | 'alto';
  missionId?: string;
  createdAt: string;
}

export type MemoryType =
  | 'Dato'
  | 'Proyecto'
  | 'Hecho verificado'
  | 'Preferencia'
  | 'Contexto de proyecto'
  | 'Decisión'
  | 'Suposición'
  | 'Aprendizaje'
  | 'Gasto'
  | 'Idea';

export interface MemoryItem {
  id: string;
  titulo: string;
  contenido: string;
  tipo: MemoryType;
  confianza: 'Alta' | 'Media' | 'Baja';
  proyecto?: string;
  permanente?: boolean;
  fecha: string;
}

export interface TemplateItem {
  id: string;
  titulo: string;
  categoria?: string;
  prioridad?: string;
  objetivo?: string;
  resultado?: string;
  criterioExito?: string;
  proximaAccion?: string;
  pasos?: string;
  variables: string;
  contenido: string;
}

export interface SkillItem {
  id: string;
  titulo: string;
  ia: AIProviderKey;
  contenido: string;
  activa: boolean;
}

export interface PromptItem {
  id: string;
  titulo: string;
  ia: AIProviderKey;
  contenido: string;
  ficha?: string;
  activa: boolean;
}

export interface AgentItem {
  id: string;
  nombre: string;
  categoria: string;
  rol: string;
  especialidades: string;
  herramientas: string;
  coste: string;
  fiabilidad: number;
  instrucciones: string;
}

export interface AladinStep {
  id: number;
  titulo: string;
  detalle: string;
  completed: boolean;
}

export interface GemaState {
  energia: number; // 0-100
  cargaCognitiva: 'Baja' | 'Moderada' | 'Alta' | 'Sobrecarga';
  nota?: string;
  actualizado: string;
}

export interface PomodoroState {
  mode: 'trabajo' | 'descanso';
  workMinutes: number;
  breakMinutes: number;
  remainingSeconds: number;
  running: boolean;
  cyclesCompleted: number;
  activeMissionId?: string;
}

export interface CliLogEntry {
  id: string;
  type: 'cmd' | 'out' | 'ok' | 'warn' | 'err';
  text: string;
  ts: string;
}

export interface UserProfile {
  nombre: string;
  objetivo: string;
  superAgenteModo: SuperAgentMode;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  memoriaAutomatica: boolean;
  alarma: boolean;
  focusMode: boolean;
}

export interface HorizonteState {
  version: string;
  schema: string;
  perfil: UserProfile;
  ajustes: UserSettings;
  gema: GemaState;
  pomodoro: PomodoroState;
  misiones: Mission[];
  tareas: TaskItem[];
  memoria: MemoryItem[];
  plantillas: TemplateItem[];
  skills: SkillItem[];
  prompts: PromptItem[];
  agentes: AgentItem[];
  aladinChecklist: AladinStep[];
}

export type AppTab =
  | 'inicio'
  | 'misiones'
  | 'biblioteca'
  | 'agentes'
  | 'memoria'
  | 'terminal'
  | 'ajustes';
