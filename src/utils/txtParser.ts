import { SEED_STATE } from '../data/seedData';
import type {
  AIProviderKey,
  AgentItem,
  AladinStep,
  CliLogEntry,
  EisenhowerQuadrant,
  HorizonteState,
  MemoryItem,
  MemoryType,
  Mission,
  MissionPriority,
  MissionStatus,
  PromptItem,
  SkillItem,
  TaskItem,
  TemplateItem,
} from '../types/horizonte';

export interface ParsedTxtResult {
  perfilNombre?: string;
  perfilObjetivo?: string;
  alarma?: boolean;
  memoriaAutomatica?: boolean;
  misiones: Mission[];
  tareas: TaskItem[];
  memoria: MemoryItem[];
  plantillas: TemplateItem[];
  skills: SkillItem[];
  prompts: PromptItem[];
  agentes: AgentItem[];
  aladinChecklist: AladinStep[];
}

function normalizeIA(raw?: string): AIProviderKey {
  const s = (raw || '').toLowerCase();
  if (s.includes('chatgpt') || s.includes('gpt')) return 'chatgpt';
  if (s.includes('claude')) return 'claude';
  if (s.includes('gemini')) return 'gemini';
  if (s.includes('deepseek')) return 'deepseek';
  if (s.includes('perplexity')) return 'perplexity';
  if (s.includes('grok')) return 'grok';
  return 'general';
}

function normalizePriority(raw?: string): MissionPriority {
  const s = (raw || '').trim();
  const valid: MissionPriority[] = [
    'Imprescindible',
    'Alta',
    'Importante',
    'Media',
    'Conveniente',
    'Prescindible',
  ];
  const found = valid.find((v) => v.toLowerCase() === s.toLowerCase());
  return found || 'Importante';
}

function normalizeStatus(raw?: string): MissionStatus {
  const s = (raw || '').trim();
  const valid: MissionStatus[] = [
    'Nueva',
    'Analizando',
    'Ejecutando',
    'Verificando',
    'Activa',
    'En riesgo',
    'Bloqueada',
    'Pausada',
    'Completada',
    'Cancelada',
  ];
  const found = valid.find((v) => v.toLowerCase() === s.toLowerCase());
  return found || 'Activa';
}

function normalizeMemoryType(raw?: string): MemoryType {
  const s = (raw || '').trim();
  const valid: MemoryType[] = [
    'Dato',
    'Proyecto',
    'Hecho verificado',
    'Preferencia',
    'Contexto de proyecto',
    'Decisión',
    'Suposición',
    'Aprendizaje',
    'Gasto',
    'Idea',
  ];
  const found = valid.find((v) => v.toLowerCase() === s.toLowerCase());
  return found || 'Dato';
}

function normalizeQuadrant(raw?: string): EisenhowerQuadrant {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'planificar' || s === 'delegar' || s === 'eliminar') return s;
  return 'hacer';
}

function normalizeEnergyCost(raw?: string): TaskItem['energyCost'] {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'bajo' || s === 'alto') return s;
  return 'medio';
}

export function parseHorizonteTxt(text: string): ParsedTxtResult {
  const result: ParsedTxtResult = {
    misiones: [],
    tareas: [],
    memoria: [],
    plantillas: [],
    skills: [],
    prompts: [],
    agentes: [],
    aladinChecklist: [],
  };

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let currentBlock: string | null = null;
  let fields: Record<string, string> = {};
  let activeMultilineKey: string | null = null;

  const flushBlock = () => {
    if (!currentBlock) return;
    const type = currentBlock.toUpperCase();

    if (type === 'PERFIL') {
      if (fields.NOMBRE) result.perfilNombre = fields.NOMBRE.trim();
      if (fields.OBJETIVO) result.perfilObjetivo = fields.OBJETIVO.trim();
    } else if (type === 'AJUSTES') {
      if (fields['ALARMA']) {
        result.alarma = ['si', 'sí', 'true', '1'].includes(fields['ALARMA'].trim().toLowerCase());
      }
      if (fields['MEMORIA AUTOMATICA']) {
        result.memoriaAutomatica = ['si', 'sí', 'true', '1'].includes(
          fields['MEMORIA AUTOMATICA'].trim().toLowerCase()
        );
      }
    } else if (type === 'AGENTE' && fields.NOMBRE) {
      result.agentes.push({
        id: crypto.randomUUID(),
        nombre: fields.NOMBRE.trim(),
        categoria: (fields.CATEGORIA || 'General').trim(),
        rol: (fields.ROL || '').trim(),
        especialidades: (fields.ESPECIALIDADES || '').trim(),
        herramientas: (fields.HERRAMIENTAS || '').trim(),
        coste: (fields.COSTE || 'Gratuito').trim(),
        fiabilidad: Math.min(100, Math.max(0, Number.parseInt(fields.FIABILIDAD || '85', 10) || 85)),
        instrucciones: (fields.INSTRUCCIONES || '').trim(),
      });
    } else if (type === 'MISION' && fields.TITULO) {
      const pasosRaw = (fields.PASOS || '').trim();
      const pasos = pasosRaw
        ? pasosRaw
            .split(/[;\n]+/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [];
      result.misiones.push({
        id: crypto.randomUUID(),
        titulo: fields.TITULO.trim(),
        categoria: (fields.CATEGORIA || 'General').trim(),
        objetivo: (fields.OBJETIVO || fields.RESULTADO || '').trim(),
        resultado: (fields.RESULTADO || '').trim(),
        contexto: (fields.CONTEXTO || '').trim(),
        restricciones: (fields.RESTRICCIONES || '').trim(),
        criterios: (fields['CRITERIO DE EXITO'] || fields.CRITERIOS || '').trim(),
        prioridad: normalizePriority(fields.PRIORIDAD),
        estado: normalizeStatus(fields.ESTADO),
        planA: (fields['PLAN A'] || '').trim(),
        planB: (fields['PLAN B'] || '').trim(),
        riesgo: (fields.RIESGO || '').trim(),
        siguiente: (fields['PROXIMA ACCION'] || fields.SIGUIENTE || 'Definir próxima acción').trim(),
        pasos,
        actualizada: new Date().toISOString(),
      });
    } else if (type === 'TAREA' && fields.TITULO) {
      result.tareas.push({
        id: crypto.randomUUID(),
        titulo: fields.TITULO.trim(),
        quadrant: normalizeQuadrant(fields.CUADRANTE),
        done: ['si', 'sí', 'true', '1', 'completada', 'hecha'].includes(
          (fields.ESTADO || fields.COMPLETADA || '').trim().toLowerCase()
        ),
        energyCost: normalizeEnergyCost(fields.ENERGIA),
        missionId: fields.MISION?.trim() || undefined,
        createdAt: fields.FECHA?.trim() || new Date().toISOString(),
      });
    } else if (type === 'MEMORIA' && (fields.TITULO || fields.CONTENIDO)) {
      result.memoria.push({
        id: crypto.randomUUID(),
        titulo: (fields.TITULO || 'Memoria importada').trim(),
        tipo: normalizeMemoryType(fields.TIPO),
        proyecto: fields.PROYECTO?.trim(),
        confianza: 'Alta',
        permanente: (fields.TITULO || '').toUpperCase().includes('PERMANENTE'),
        fecha: fields.FECHA?.trim() || new Date().toISOString(),
        contenido: (fields.CONTENIDO || '').trim(),
      });
    } else if (type === 'PLANTILLA' && fields.TITULO) {
      const objetivo = (fields.OBJETIVO || '').trim();
      const resultado = (fields.RESULTADO || '').trim();
      const pasos = (fields.PASOS || '').trim();
      result.plantillas.push({
        id: crypto.randomUUID(),
        titulo: fields.TITULO.trim(),
        categoria: (fields.CATEGORIA || 'General').trim(),
        prioridad: (fields.PRIORIDAD || 'Media').trim(),
        objetivo,
        resultado,
        criterioExito: (fields['CRITERIO DE EXITO'] || '').trim(),
        proximaAccion: (fields['PROXIMA ACCION'] || '').trim(),
        pasos,
        variables: (fields.VARIABLES || '').trim(),
        contenido:
          (fields.CONTENIDO || '').trim() ||
          `Objetivo: ${objetivo}\nResultado: ${resultado}\nPasos: ${pasos}`,
      });
    } else if (type === 'SKILL' && fields.TITULO) {
      result.skills.push({
        id: crypto.randomUUID(),
        titulo: fields.TITULO.trim(),
        ia: normalizeIA(fields.IA),
        categoria: (fields.CATEGORIA || 'General').trim(),
        contenido: (fields.CONTENIDO || '').trim(),
        activa: false,
      });
    } else if (type === 'PROMPT' && fields.TITULO) {
      result.prompts.push({
        id: crypto.randomUUID(),
        titulo: fields.TITULO.trim(),
        ia: normalizeIA(fields.IA),
        categoria: (fields.CATEGORIA || 'General').trim(),
        contenido: (fields.CONTENIDO || '').trim(),
        activa: false,
      });
    } else if (type === 'ALADIN' && fields.TITULO) {
      const stepNum = Number.parseInt(fields.PASO || '', 10);
      result.aladinChecklist.push({
        id: Number.isNaN(stepNum) ? result.aladinChecklist.length + 1 : stepNum,
        titulo: fields.TITULO.trim(),
        detalle: (fields.DETALLE || fields.CONTENIDO || '').trim(),
        completed: ['si', 'sí', 'true', '1', 'completada'].includes(
          (fields.COMPLETADA || fields.ESTADO || '').trim().toLowerCase()
        ),
      });
    }

    fields = {};
    activeMultilineKey = null;
  };

  const singleFieldKeys = [
    'NOMBRE',
    'CATEGORIA',
    'ROL',
    'ESPECIALIDADES',
    'HERRAMIENTAS',
    'COSTE',
    'FIABILIDAD',
    'TITULO',
    'RESULTADO',
    'PRIORIDAD',
    'ESTADO',
    'CRITERIO DE EXITO',
    'PROXIMA ACCION',
    'OBJETIVO',
    'TIPO',
    'FECHA',
    'PROYECTO',
    'IA',
    'MEMORIA AUTOMATICA',
    'ALARMA',
    'VARIABLES',
    'CONTEXTO',
    'RESTRICCIONES',
    'PLAN A',
    'PLAN B',
    'RIESGO',
    'CUADRANTE',
    'ENERGIA',
    'COMPLETADA',
    'MISION',
    'PASO',
    'DETALLE',
  ];

  const multiFieldKeys = ['CONTENIDO', 'INSTRUCCIONES', 'PASOS'];

  for (const line of lines) {
    const headerMatch = line.match(/^===\s*([A-ZÁÉÍÓÚÜ0-9 _-]+?)\s*===$/);
    if (headerMatch) {
      const headerName = headerMatch[1].trim().toUpperCase();
      if (headerName.includes('HORIZONTE OS')) {
        flushBlock();
        currentBlock = null;
        continue;
      }
      flushBlock();
      currentBlock = headerName;
      continue;
    }

    if (!currentBlock) continue;

    // Inside multiline content, preserve lines unless a new valid block header appears or a known key appears when NOT inside CONTENIDO/INSTRUCCIONES
    if (activeMultilineKey && (activeMultilineKey === 'CONTENIDO' || activeMultilineKey === 'INSTRUCCIONES')) {
      fields[activeMultilineKey] = fields[activeMultilineKey]
        ? `${fields[activeMultilineKey]}\n${line}`
        : line;
      continue;
    }

    const kvMatch = line.match(/^([A-ZÁÉÍÓÚÜ ]+):(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toUpperCase();
      const val = kvMatch[2].trim();
      if (multiFieldKeys.includes(key)) {
        activeMultilineKey = key;
        fields[key] = val;
        continue;
      }
      if (singleFieldKeys.includes(key)) {
        activeMultilineKey = null;
        fields[key] = val;
        continue;
      }
    }

    if (activeMultilineKey) {
      fields[activeMultilineKey] = fields[activeMultilineKey]
        ? `${fields[activeMultilineKey]}\n${line}`
        : line;
    }
  }

  flushBlock();
  return result;
}

export function exportHorizonteTxt(state: HorizonteState): string {
  const parts: string[] = [];
  parts.push('=== COPIA HORIZONTE OS ===');
  parts.push(`VERSION: ${state.version}`);
  parts.push('FORMATO: TXT-1');
  parts.push('');
  parts.push('=== PERFIL ===');
  parts.push(`NOMBRE: ${state.perfil.nombre}`);
  parts.push(`OBJETIVO: ${state.perfil.objetivo}`);
  parts.push('');
  parts.push('=== AJUSTES ===');
  parts.push(`MEMORIA AUTOMATICA: ${state.ajustes.memoriaAutomatica ? 'si' : 'no'}`);
  parts.push(`ALARMA: ${state.ajustes.alarma ? 'si' : 'no'}`);

  for (const m of state.misiones) {
    parts.push('');
    parts.push('=== MISION ===');
    parts.push(`TITULO: ${m.titulo}`);
    if (m.resultado) parts.push(`RESULTADO: ${m.resultado}`);
    parts.push(`PRIORIDAD: ${m.prioridad}`);
    parts.push(`ESTADO: ${m.estado}`);
    if (m.criterios) parts.push(`CRITERIO DE EXITO: ${m.criterios}`);
    if (m.siguiente) parts.push(`PROXIMA ACCION: ${m.siguiente}`);
    if (m.pasos && m.pasos.length > 0) {
      parts.push('PASOS:');
      parts.push(m.pasos.join('; ') + '.');
    }
  }

  for (const t of state.tareas) {
    parts.push('');
    parts.push('=== TAREA ===');
    parts.push(`TITULO: ${t.titulo}`);
    parts.push(`CUADRANTE: ${t.quadrant}`);
    parts.push(`ENERGIA: ${t.energyCost}`);
    parts.push(`COMPLETADA: ${t.done ? 'si' : 'no'}`);
    if (t.missionId) parts.push(`MISION: ${t.missionId}`);
    parts.push(`FECHA: ${t.createdAt}`);
  }

  for (const mem of state.memoria) {
    parts.push('');
    parts.push('=== MEMORIA ===');
    parts.push(`TITULO: ${mem.titulo}`);
    parts.push(`TIPO: ${mem.tipo}`);
    if (mem.proyecto) parts.push(`PROYECTO: ${mem.proyecto}`);
    parts.push(`FECHA: ${mem.fecha}`);
    parts.push('CONTENIDO:');
    parts.push(mem.contenido);
  }

  for (const pr of state.prompts) {
    parts.push('');
    parts.push('=== PROMPT ===');
    parts.push(`TITULO: ${pr.titulo}`);
    parts.push(`IA: ${pr.ia}`);
    if (pr.categoria) parts.push(`CATEGORIA: ${pr.categoria}`);
    parts.push('CONTENIDO:');
    parts.push(pr.contenido);
  }

  for (const sk of state.skills) {
    parts.push('');
    parts.push('=== SKILL ===');
    parts.push(`TITULO: ${sk.titulo}`);
    parts.push(`IA: ${sk.ia}`);
    if (sk.categoria) parts.push(`CATEGORIA: ${sk.categoria}`);
    parts.push('CONTENIDO:');
    parts.push(sk.contenido);
  }

  for (const pl of state.plantillas) {
    parts.push('');
    parts.push('=== PLANTILLA ===');
    parts.push(`TITULO: ${pl.titulo}`);
    if (pl.categoria) parts.push(`CATEGORIA: ${pl.categoria}`);
    if (pl.prioridad) parts.push(`PRIORIDAD: ${pl.prioridad}`);
    if (pl.objetivo) parts.push(`OBJETIVO: ${pl.objetivo}`);
    if (pl.resultado) parts.push(`RESULTADO: ${pl.resultado}`);
    if (pl.criterioExito) parts.push(`CRITERIO DE EXITO: ${pl.criterioExito}`);
    if (pl.proximaAccion) parts.push(`PROXIMA ACCION: ${pl.proximaAccion}`);
    if (pl.pasos) {
      parts.push('PASOS:');
      parts.push(pl.pasos);
    }
  }

  for (const ag of state.agentes) {
    parts.push('');
    parts.push('=== AGENTE ===');
    parts.push(`NOMBRE: ${ag.nombre}`);
    parts.push(`CATEGORIA: ${ag.categoria}`);
    parts.push(`ROL: ${ag.rol}`);
    parts.push(`ESPECIALIDADES: ${ag.especialidades}`);
    parts.push(`HERRAMIENTAS: ${ag.herramientas}`);
    parts.push(`COSTE: ${ag.coste}`);
    parts.push(`FIABILIDAD: ${ag.fiabilidad}`);
    parts.push('INSTRUCCIONES:');
    parts.push(ag.instrucciones);
  }

  for (const st of state.aladinChecklist || []) {
    parts.push('');
    parts.push('=== ALADIN ===');
    parts.push(`PASO: ${st.id}`);
    parts.push(`TITULO: ${st.titulo}`);
    parts.push(`COMPLETADA: ${st.completed ? 'si' : 'no'}`);
    parts.push(`DETALLE: ${st.detalle}`);
  }

  return parts.join('\n');
}

export function migrateJsonState(rawInput: unknown): Partial<HorizonteState> {
  const rawObj =
    rawInput && typeof rawInput === 'object' && 'state' in rawInput
      ? ((rawInput as { state: Record<string, unknown> }).state || (rawInput as Record<string, unknown>))
      : (rawInput as Record<string, unknown>);

  if (!rawObj || typeof rawObj !== 'object') {
    throw new Error('Estructura JSON no reconocida.');
  }

  const partial: Partial<HorizonteState> = {};

  if (Array.isArray(rawObj.misiones)) {
    partial.misiones = rawObj.misiones.map((m: Record<string, unknown>) => ({
      id: String(m.id || crypto.randomUUID()),
      titulo: String(m.titulo || 'Misión sin título'),
      categoria: m.categoria ? String(m.categoria) : 'General',
      objetivo: String(m.objetivo || ''),
      resultado: m.resultado ? String(m.resultado) : '',
      contexto: String(m.contexto || ''),
      restricciones: String(m.restricciones || ''),
      criterios: String(m.criterios || ''),
      prioridad: normalizePriority(String(m.prioridad || 'Importante')),
      estado: normalizeStatus(String(m.estado || 'Nueva')),
      planA: String(m.planA || ''),
      planB: String(m.planB || ''),
      riesgo: String(m.riesgo || ''),
      siguiente: String(m.siguiente || 'Definir próxima acción'),
      pasos: Array.isArray(m.pasos) ? m.pasos.map(String) : [],
      agentes: Array.isArray(m.agentes) ? m.agentes.map(String) : [],
      telefono: m.telefono ? String(m.telefono) : '',
      actualizada: String(m.actualizada || new Date().toISOString()),
    }));
  }

  if (Array.isArray(rawObj.tareas)) {
    partial.tareas = rawObj.tareas as HorizonteState['tareas'];
  }

  // Support both `memoria` (v12/v18.4) and `memories` (v19.3/v19.4 patch)
  const memRaw = Array.isArray(rawObj.memoria)
    ? rawObj.memoria
    : Array.isArray(rawObj.memories)
      ? rawObj.memories
      : null;

  if (memRaw) {
    partial.memoria = memRaw.map((m: Record<string, unknown>) => ({
      id: String(m.id || crypto.randomUUID()),
      titulo: String(m.titulo || m.title || 'Memoria'),
      contenido: String(m.contenido || m.content || m.text || ''),
      tipo: normalizeMemoryType(String(m.tipo || m.type || 'Dato')),
      confianza: (m.confianza === 'Media' || m.confianza === 'Baja' ? m.confianza : 'Alta') as
        | 'Alta'
        | 'Media'
        | 'Baja',
      proyecto: m.proyecto ? String(m.proyecto) : undefined,
      permanente: Boolean(m.permanente),
      fecha: String(m.fecha || m.date || new Date().toISOString()),
    }));
  }

  if (Array.isArray(rawObj.plantillas)) {
    partial.plantillas = rawObj.plantillas.map((p: Record<string, unknown>) => ({
      id: String(p.id || crypto.randomUUID()),
      titulo: String(p.titulo || 'Plantilla'),
      categoria: p.categoria ? String(p.categoria) : 'General',
      prioridad: p.prioridad ? String(p.prioridad) : 'Media',
      objetivo: p.objetivo ? String(p.objetivo) : '',
      resultado: p.resultado ? String(p.resultado) : '',
      criterioExito: p.criterioExito ? String(p.criterioExito) : '',
      proximaAccion: p.proximaAccion ? String(p.proximaAccion) : '',
      pasos: p.pasos ? String(p.pasos) : '',
      variables: String(p.variables || ''),
      contenido: String(p.contenido || ''),
    }));
  }

  if (Array.isArray(rawObj.skills)) {
    partial.skills = rawObj.skills.map((s: Record<string, unknown>) => ({
      id: String(s.id || crypto.randomUUID()),
      titulo: String(s.titulo || s.title || 'Skill'),
      ia: normalizeIA(String(s.ia || 'general')),
      categoria: s.categoria ? String(s.categoria) : 'General',
      contenido: String(s.contenido || s.content || ''),
      activa: Boolean(s.activa),
    }));
  }

  if (Array.isArray(rawObj.prompts)) {
    partial.prompts = rawObj.prompts.map((p: Record<string, unknown>) => ({
      id: String(p.id || crypto.randomUUID()),
      titulo: String(p.titulo || p.title || 'Prompt'),
      ia: normalizeIA(String(p.ia || 'general')),
      categoria: p.categoria ? String(p.categoria) : 'General',
      contenido: String(p.contenido || p.content || ''),
      ficha: p.ficha ? String(p.ficha) : undefined,
      activa: Boolean(p.activa),
    }));
  }

  if (Array.isArray(rawObj.agentes)) {
    partial.agentes = rawObj.agentes as AgentItem[];
  }

  if (Array.isArray(rawObj.aladinChecklist)) {
    partial.aladinChecklist = rawObj.aladinChecklist as AladinStep[];
  }

  if (rawObj.gema && typeof rawObj.gema === 'object') {
    partial.gema = rawObj.gema as HorizonteState['gema'];
  }

  if (rawObj.perfil && typeof rawObj.perfil === 'object') {
    partial.perfil = { ...SEED_STATE.perfil, ...(rawObj.perfil as HorizonteState['perfil']) };
  }

  return partial;
}

export function exportHorizonteJson(state: HorizonteState): string {
  return JSON.stringify(
    {
      version: state.version,
      schema: state.schema,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2
  );
}

export function downloadTextFile(
  content: string,
  filename: string,
  mime = 'text/plain;charset=utf-8'
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSectionJson(section: string, stateSlice: Record<string, unknown>): string {
  return JSON.stringify(
    {
      version: '19.4',
      schema: '19.3.0',
      module: section,
      exportedAt: new Date().toISOString(),
      state: stateSlice,
    },
    null,
    2
  );
}

export function exportPartialTxt(options: {
  title: string;
  misiones?: Mission[];
  tareas?: TaskItem[];
  memoria?: MemoryItem[];
  prompts?: PromptItem[];
  skills?: SkillItem[];
  plantillas?: TemplateItem[];
  agentes?: AgentItem[];
  aladinChecklist?: AladinStep[];
}): string {
  const parts: string[] = [
    `=== COPIA HORIZONTE OS (${options.title.toUpperCase()}) ===`,
    'VERSION: 19.4',
    'FORMATO: TXT-1',
  ];

  for (const m of options.misiones || []) {
    parts.push('', '=== MISION ===', `TITULO: ${m.titulo}`);
    if (m.categoria) parts.push(`CATEGORIA: ${m.categoria}`);
    if (m.objetivo) parts.push(`OBJETIVO: ${m.objetivo}`);
    if (m.resultado) parts.push(`RESULTADO: ${m.resultado}`);
    parts.push(`PRIORIDAD: ${m.prioridad}`, `ESTADO: ${m.estado}`);
    if (m.criterios) parts.push(`CRITERIO DE EXITO: ${m.criterios}`);
    if (m.siguiente) parts.push(`PROXIMA ACCION: ${m.siguiente}`);
    if (m.pasos && m.pasos.length > 0) parts.push('PASOS:', m.pasos.join('; ') + '.');
  }

  for (const t of options.tareas || []) {
    parts.push(
      '',
      '=== TAREA ===',
      `TITULO: ${t.titulo}`,
      `CUADRANTE: ${t.quadrant}`,
      `ENERGIA: ${t.energyCost}`,
      `COMPLETADA: ${t.done ? 'si' : 'no'}`,
      `FECHA: ${t.createdAt}`
    );
  }

  for (const mem of options.memoria || []) {
    parts.push(
      '',
      '=== MEMORIA ===',
      `TITULO: ${mem.titulo}`,
      `TIPO: ${mem.tipo}`
    );
    if (mem.proyecto) parts.push(`PROYECTO: ${mem.proyecto}`);
    parts.push(`FECHA: ${mem.fecha}`, 'CONTENIDO:', mem.contenido);
  }

  for (const pr of options.prompts || []) {
    parts.push('', '=== PROMPT ===', `TITULO: ${pr.titulo}`, `IA: ${pr.ia}`);
    if (pr.categoria) parts.push(`CATEGORIA: ${pr.categoria}`);
    parts.push('CONTENIDO:', pr.contenido);
  }

  for (const sk of options.skills || []) {
    parts.push('', '=== SKILL ===', `TITULO: ${sk.titulo}`, `IA: ${sk.ia}`);
    if (sk.categoria) parts.push(`CATEGORIA: ${sk.categoria}`);
    parts.push('CONTENIDO:', sk.contenido);
  }

  for (const pl of options.plantillas || []) {
    parts.push('', '=== PLANTILLA ===', `TITULO: ${pl.titulo}`);
    if (pl.categoria) parts.push(`CATEGORIA: ${pl.categoria}`);
    if (pl.prioridad) parts.push(`PRIORIDAD: ${pl.prioridad}`);
    if (pl.objetivo) parts.push(`OBJETIVO: ${pl.objetivo}`);
    if (pl.resultado) parts.push(`RESULTADO: ${pl.resultado}`);
    if (pl.criterioExito) parts.push(`CRITERIO DE EXITO: ${pl.criterioExito}`);
    if (pl.proximaAccion) parts.push(`PROXIMA ACCION: ${pl.proximaAccion}`);
    if (pl.pasos) parts.push('PASOS:', pl.pasos);
  }

  for (const ag of options.agentes || []) {
    parts.push(
      '',
      '=== AGENTE ===',
      `NOMBRE: ${ag.nombre}`,
      `CATEGORIA: ${ag.categoria}`,
      `ROL: ${ag.rol}`,
      `ESPECIALIDADES: ${ag.especialidades}`,
      `HERRAMIENTAS: ${ag.herramientas}`,
      `COSTE: ${ag.coste}`,
      `FIABILIDAD: ${ag.fiabilidad}`,
      'INSTRUCCIONES:',
      ag.instrucciones
    );
  }

  for (const st of options.aladinChecklist || []) {
    parts.push(
      '',
      '=== ALADIN ===',
      `PASO: ${st.id}`,
      `TITULO: ${st.titulo}`,
      `COMPLETADA: ${st.completed ? 'si' : 'no'}`,
      `DETALLE: ${st.detalle}`
    );
  }

  return parts.join('\n');
}

export function exportCliLogsTxt(logs: CliLogEntry[]): string {
  const lines = [
    '=== HISTORIAL CLI HORIZONTE OS ===',
    `FECHA: ${new Date().toISOString()}`,
    '',
    ...logs.map((l) => `[${l.ts}] [${l.type.toUpperCase()}] ${l.type === 'cmd' ? `$ ${l.text}` : l.text}`),
  ];
  return lines.join('\n');
}

export function runDryRunDiagnostic(state: HorizonteState): {
  ok: boolean;
  checks: { label: string; pass: boolean; detail: string }[];
} {
  const checks = [
    {
      label: 'Schema y versión',
      pass: state.version === '19.4' && Boolean(state.schema),
      detail: `v${state.version} (schema ${state.schema})`,
    },
    {
      label: 'Persistencia localStorage',
      pass: (() => {
        try {
          const testKey = '__horizonte_dryrun_test__';
          localStorage.setItem(testKey, '1');
          localStorage.removeItem(testKey);
          return true;
        } catch {
          return false;
        }
      })(),
      detail: 'Lectura y escritura local operativa',
    },
    {
      label: 'Integridad de Misiones y Tareas',
      pass: Array.isArray(state.misiones) && Array.isArray(state.tareas),
      detail: `${state.misiones.length} misiones · ${state.tareas.length} tareas`,
    },
    {
      label: 'Biblioteca IA (Prompts, Skills, Plantillas)',
      pass:
        state.prompts.length > 0 && state.skills.length > 0 && state.plantillas.length > 0,
      detail: `${state.prompts.length} prompts · ${state.skills.length} skills · ${state.plantillas.length} plantillas`,
    },
    {
      label: 'Red de Agentes y Memoria Permanente',
      pass: state.agentes.length > 0 && state.memoria.length > 0,
      detail: `${state.agentes.length} agentes · ${state.memoria.length} memorias`,
    },
    {
      label: 'Motor GEMA y Pomodoro',
      pass:
        state.gema.energia >= 0 &&
        state.gema.energia <= 100 &&
        state.pomodoro.remainingSeconds >= 0,
      detail: `Energía ${state.gema.energia}% (${state.gema.cargaCognitiva}) · ${Math.floor(state.pomodoro.remainingSeconds / 60)}m`,
    },
  ];

  return {
    ok: checks.every((c) => c.pass),
    checks,
  };
}
