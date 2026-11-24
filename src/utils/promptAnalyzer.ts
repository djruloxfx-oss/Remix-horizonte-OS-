export interface PromptSuggestionCheck {
  id: string;
  label: string;
  passed: boolean;
  tip: string;
  snippet: string;
}

export interface PromptAnalysisResult {
  score: number;
  grade: 'Excelente' | 'Sólido' | 'Mejorable' | 'Básico';
  checks: PromptSuggestionCheck[];
  improvedPrompt: string;
}

export function analyzePrompt(
  rawText: string,
  category = 'General'
): PromptAnalysisResult {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  const hasRole =
    /\b(act[uú]a como|eres un|eres una|eres el|rol:|experto en|especialista|asistente)\b/i.test(
      text
    );
  const hasGoal =
    text.length >= 45 &&
    /\b(objetivo|misi[oó]n|tarea|analiza|crea|genera|resume|dise[nñ]a|eval[uú]a|redacta|compara|explica)\b/i.test(
      text
    );
  const hasContextOrVars =
    /\[[A-ZÁÉÍÓÚÜ0-9 _,-]{2,}\]|\{\{[^}]+\}\}|\b(contexto|variables|entrada|datos|audiencia|para quién)\b/i.test(
      text
    );
  const hasConstraints =
    /\b(no inventes|verific|evita|prohibid|sin |m[aá]ximo|l[ií]mite|restricci|reglas|criterio|si no sabes|pendiente)\b/i.test(
      text
    );
  const hasOutputFormat =
    /\b(formato|tabla|lista|json|markdown|puntos|pasos|estructura|secciones|ficha|breve|extensi[oó]n)\b/i.test(
      text
    );

  const checks: PromptSuggestionCheck[] = [
    {
      id: 'role',
      label: 'Rol y perspectiva',
      passed: hasRole,
      tip: 'Define quién ejecuta la tarea para fijar criterio técnico y tono.',
      snippet: `ROL: Actúa como especialista sénior en ${category || 'la materia'}, orientado a resultados verificables y prácticos.`,
    },
    {
      id: 'goal',
      label: 'Objetivo accionable',
      passed: hasGoal,
      tip: 'Expresa con un verbo concreto qué entregable esperas obtener.',
      snippet:
        'OBJETIVO: Resuelve la petición entregando un resultado directamente utilizable, sin rodeos.',
    },
    {
      id: 'context',
      label: 'Contexto o variables',
      passed: hasContextOrVars,
      tip: 'Añade marcadores entre corchetes [VARIABLE] para reutilizar el prompt fácilmente.',
      snippet:
        'CONTEXTO Y VARIABLES:\n- Situación actual: [CONTEXTO]\n- Restricción principal / plazo: [RESTRICCION]',
    },
    {
      id: 'constraints',
      label: 'Reglas de verificación',
      passed: hasConstraints,
      tip: 'Incluye límites anti-alucinación para evitar datos inventados o relleno.',
      snippet:
        'REGLAS Y VERIFICACIÓN:\n- No inventes fuentes, cifras ni capacidades.\n- Si falta un dato clave, indícalo como PENDIENTE antes de asumirlo.',
    },
    {
      id: 'format',
      label: 'Formato de salida',
      passed: hasOutputFormat,
      tip: 'Especifica la estructura exacta de respuesta (tabla, pasos, checklist o resumen).',
      snippet:
        'FORMATO DE SALIDA:\n1. Resumen ejecutivo (máx. 3 líneas)\n2. Desarrollo estructurado o tabla comparativa\n3. Próxima acción recomendada',
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const grade: PromptAnalysisResult['grade'] =
    score >= 90
      ? 'Excelente'
      : score >= 70
        ? 'Sólido'
        : score >= 45
          ? 'Mejorable'
          : 'Básico';

  if (!text) {
    return {
      score: 0,
      grade: 'Básico',
      checks,
      improvedPrompt: checks.map((c) => c.snippet).join('\n\n'),
    };
  }

  const missingBlocks = checks.filter((c) => !c.passed);
  if (missingBlocks.length === 0) {
    return {
      score,
      grade,
      checks,
      improvedPrompt: text,
    };
  }

  const prefixBlocks = missingBlocks
    .filter((b) => b.id === 'role' || b.id === 'goal')
    .map((b) => b.snippet);
  const suffixBlocks = missingBlocks
    .filter((b) => b.id !== 'role' && b.id !== 'goal')
    .map((b) => b.snippet);

  const sections: string[] = [];
  if (prefixBlocks.length > 0) sections.push(prefixBlocks.join('\n\n'));
  sections.push(
    hasRole || hasGoal ? text : `INSTRUCCIÓN BASE:\n${text}`
  );
  if (suffixBlocks.length > 0) sections.push(suffixBlocks.join('\n\n'));

  return {
    score,
    grade,
    checks,
    improvedPrompt: sections.join('\n\n'),
  };
}
