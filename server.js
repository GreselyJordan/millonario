const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.static(path.join(__dirname)));

const rooms = new Map();
const REVEAL_TIME = 8; // seconds to show answer+leaderboard before auto-advancing

// ── PREGUNTAS ────────────────────────────────────────────────────────────────
const ALL_QUESTIONS = [
  {text:"En el análisis del macroentorno, ¿cuál es el propósito principal de identificar factores como los económicos, políticos, sociales, tecnológicos, ecológicos y legales?",options:["Controlar únicamente las actividades internas de la empresa","Determinar únicamente los costos de producción","Analizar factores externos que pueden influir en las decisiones estratégicas","Supervisar el desempeño de los empleados"],correct:2,difficulty:"easy",justification:"El análisis del macroentorno busca identificar factores externos que afectan a la empresa, permitiendo anticipar oportunidades y amenazas para tomar mejores decisiones estratégicas."},
  {text:"¿Cuáles de los siguientes elementos corresponden con mayor claridad al microentorno de una empresa?",options:["Inflación y políticas gubernamentales","Cambios climáticos globales","Clientes, proveedores y competidores","Tendencias culturales internacionales"],correct:2,difficulty:"easy",justification:"El microentorno está formado por actores cercanos a la empresa que influyen directamente en sus operaciones y competitividad."},
  {text:"Al construir la matriz FODA, ¿qué combinación describe correctamente cada cuadrante?",options:["Solo aspectos financieros y administrativos","Elementos tecnológicos y legales únicamente","Variables económicas y sociales exclusivamente","Factores internos y externos positivos y negativos"],correct:3,difficulty:"medium",justification:"La matriz FODA combina fortalezas y debilidades internas con oportunidades y amenazas externas."},
  {text:"En la identificación de factores estratégicos externos, ¿cuál es el criterio más adecuado para considerar que un factor detectado es realmente estratégico?",options:["Que sea fácil de controlar por la organización","Que dependa solo de los empleados","Que tenga impacto significativo en la empresa y sus objetivos","Que no afecte la competencia"],correct:2,difficulty:"medium",justification:"Un factor estratégico es aquel que puede influir considerablemente en el desempeño y éxito de la empresa."},
  {text:"Respecto a los factores estratégicos internos, ¿cuál de los siguientes ejemplos ilustra mejor una fortaleza interna relevante para la estrategia?",options:["Alta rotación de personal","Marca reconocida y buena reputación","Tecnología obsoleta","Disminución de ventas"],correct:1,difficulty:"easy",justification:"Una marca sólida representa una ventaja competitiva interna que fortalece la estrategia empresarial."},
  {text:"Al formular objetivos estratégicos, ¿cuál de las siguientes características es esencial para que un objetivo sea útil en la gestión?",options:["Que no tenga límite de tiempo","Que dependa del azar","Que sea ambiguo y flexible","Que sea medible y específico"],correct:3,difficulty:"easy",justification:"Los objetivos deben ser claros y medibles para facilitar el control y evaluación de resultados."},
  {text:"Las estrategias maestras (como crecimiento, estabilidad o reducción/recorte) se caracterizan por:",options:["Ser actividades operativas diarias","Limitar el desarrollo organizacional","Orientar la dirección general de la empresa","Aplicarse solo en pequeñas empresas"],correct:2,difficulty:"medium",justification:"Las estrategias maestras definen el rumbo principal que seguirá la organización."},
  {text:"¿Cuál es el rol principal de las políticas empresariales dentro del proceso de implementación estratégica?",options:["Reemplazar los objetivos estratégicos","Guiar la toma de decisiones y acciones organizacionales","Eliminar la necesidad de planificación","Reducir únicamente costos"],correct:1,difficulty:"medium",justification:"Las políticas sirven como lineamientos que orientan las decisiones y la ejecución de estrategias."},
  {text:"En la implementación del plan estratégico, ¿cuál de los siguientes aspectos es más crítico para asegurar que las estrategias formuladas se conviertan en resultados concretos?",options:["Improvisación constante","Ausencia de liderazgo","Falta de seguimiento","Comunicación y coordinación efectiva"],correct:3,difficulty:"hard",justification:"La comunicación clara permite que todos los miembros comprendan los objetivos, mientras que la coordinación asegura que las diferentes áreas trabajen de forma alineada."},
  {text:"¿Cuál es la relación más adecuada entre el análisis FODA y la formulación de estrategias?",options:["Reemplazar la planificación","Eliminar riesgos","Analizar únicamente debilidades","Diseñar estrategias basadas en el entorno"],correct:3,difficulty:"medium",justification:"El análisis FODA permite identificar fortalezas, oportunidades, debilidades y amenazas, proporcionando una visión integral de la situación de la empresa."},
  {text:"Una empresa del sector minorista enfrenta incertidumbre por elecciones presidenciales que podrían cambiar las regulaciones laborales. ¿En qué etapa del proceso estratégico debe analizarse primero este factor?",options:["En la etapa de implementación","En el control estratégico","En el análisis interno","En el análisis del macroentorno, porque es un factor político externo"],correct:3,difficulty:"hard",justification:"Los factores externos como las regulaciones forman parte del entorno político-legal del macroentorno, que afecta las condiciones del mercado."},
  {text:"En el análisis del macroentorno, ¿cuál de las siguientes variables pertenece parcialmente a este nivel y no al microentorno?",options:["Clientes","Competidores","Políticas gubernamentales","Proveedores"],correct:2,difficulty:"medium",justification:"Las políticas gubernamentales son factores externos que impactan a todas las empresas de manera general, no pueden ser controladas por la empresa."},
  {text:"En formulación estratégica, ¿cuál es la principal diferencia funcional entre misión y visión que justifica incluir la visión antes de los objetivos SMART?",options:["Sustituye la misión","Define tareas diarias","Establece normas internas","Guiar el rumbo estratégico"],correct:3,difficulty:"medium",justification:"La visión establece hacia dónde quiere llegar la empresa en el futuro, orientando las decisiones estratégicas a largo plazo."},
  {text:"En la identificación de factores clave externos para un plan estratégico, ¿cuál de los siguientes ejemplos describe mejor una oportunidad?",options:["Factor interno negativo","Factor externo negativo","Factor interno positivo","Factor externo favorable"],correct:3,difficulty:"easy",justification:"Una oportunidad es una condición del entorno externo que puede ser aprovechada por la empresa para mejorar su posición competitiva."},
  {text:"¿Cuál de las siguientes alternativas representa mejor un factor clave interno de tipo fortaleza?",options:["Falta de recursos","Mala imagen","Baja productividad","Personal capacitado"],correct:3,difficulty:"easy",justification:"El personal capacitado representa una ventaja interna que permite a la empresa ser más eficiente, innovadora y competitiva."},
  {text:"En la construcción de la matriz FODA, ¿qué combinación describe correctamente una amenaza?",options:["Factor interno positivo","Factor interno negativo","Factor externo positivo","Factor externo negativo"],correct:3,difficulty:"easy",justification:"Una amenaza proviene del entorno externo y puede afectar negativamente a la empresa, como crisis económicas o cambios regulatorios adversos."},
  {text:"¿Cuál es el principal propósito de la matriz FODA dentro del proceso de formulación estratégica?",options:["Sustituir la misión","Controlar finanzas","Eliminar competencia","Analizar integralmente la empresa"],correct:3,difficulty:"easy",justification:"El FODA integra tanto el análisis interno como externo, permitiendo una visión completa de la situación organizacional."},
  {text:"Una empresa desea iniciar su proceso de formulación estratégica. ¿Cuál debería ser el primer foco principal para asegurar una base sólida del plan estratégico?",options:["Ejecutar acciones","Evaluar resultados","Controlar procesos","Analizar el entorno"],correct:3,difficulty:"medium",justification:"Antes de tomar decisiones es necesario comprender el contexto en el que opera la empresa, identificando oportunidades y riesgos."},
  {text:"En el análisis del macroentorno, ¿cuál de las siguientes variables pertenece a este nivel y no al microentorno?",options:["Clientes","Proveedores","Distribuidores","Tecnología del entorno"],correct:3,difficulty:"medium",justification:"La tecnología forma parte del macroentorno al ser un factor externo general que afecta a todas las organizaciones de una industria."},
  {text:"En el análisis del microentorno, ¿cuál de los siguientes elementos es más relevante para identificar amenazas competitivas directas?",options:["Inflación","Política nacional","Cultura interna","Competidores"],correct:3,difficulty:"easy",justification:"Los competidores forman parte del microentorno al influir de manera directa en las decisiones estratégicas de la empresa."},
  {text:"Una empresa tecnológica desea analizar cómo la regulación estatal futura sobre protección de datos podría afectar su modelo de negocio. ¿En qué parte del análisis del entorno estratégico debería ubicarse principalmente este aspecto?",options:["Interno","Operativo","Financiero","Legal externo"],correct:3,difficulty:"medium",justification:"Las leyes y regulaciones son factores externos que forman parte del entorno político-legal, impuestas por el Estado y condicionan la operación de las empresas."},
  {text:"En una formulación estratégica rigurosa, ¿cuál de los siguientes ejemplos describe mejor un objetivo SMART?",options:["Aumentar ventas algún día","Mejorar la empresa","Tener éxito en el mercado","Incrementar ventas en un 10% en un año"],correct:3,difficulty:"medium",justification:"Cumple con los criterios SMART: específico, medible, alcanzable, relevante y temporal. Las demás opciones son demasiado generales o ambiguas."},
  {text:"En el marco de la matriz FODA, ¿cuál de las siguientes combinaciones representa mejor una estrategia FO (Fortalezas-Oportunidades) bien formulada?",options:["Reducir debilidades internas","Evitar amenazas externas","Minimizar riesgos","Utilizar fortalezas para aprovechar oportunidades"],correct:3,difficulty:"hard",justification:"Las estrategias FO buscan aprovechar las capacidades internas de la empresa para explotar condiciones favorables del entorno, generando ventaja competitiva sostenible."},
  {text:"Al analizar el microentorno competitivo, una empresa identifica que tres nuevos competidores de bajo costo han entrado en su mercado local. ¿Cómo debería clasificar este hallazgo dentro de la matriz FODA?",options:["Fortaleza","Amenaza","Debilidad","Oportunidad"],correct:1,difficulty:"hard",justification:"Nuevos competidores de bajo costo representan una amenaza externa que puede afectar negativamente la posición competitiva de la empresa."},
  {text:"Una compañía de servicios profesionales detecta que posee un equipo altamente calificado y una reputación sólida en el mercado, pero su estructura organizativa es rígida y sus sistemas son obsoletos. ¿Cómo deben clasificarse estos elementos en el análisis interno?",options:["Oportunidades y amenazas","Factores políticos","Factores económicos","Fortalezas y debilidades"],correct:3,difficulty:"medium",justification:"Las fortalezas y debilidades son aspectos propios de la organización que pueden ser controlados y gestionados."},
  {text:"Al definir estrategias maestras, una empresa decide enfocarse en vender más productos actuales a los mismos segmentos mediante promociones y fidelización. ¿Qué tipo de estrategia maestra describe mejor este enfoque?",options:["Diversificación","Integración","Reducción","Penetración de mercado"],correct:3,difficulty:"medium",justification:"La estrategia de penetración de mercado se centra en incrementar las ventas de productos existentes dentro del mismo mercado objetivo."},
  {text:"En un proceso de gestión del cambio asociado a la implementación estratégica, la dirección decide comunicar la visión, capacitar al personal y ajustar los sistemas de incentivos. ¿Qué objetivo central persiguen estas acciones?",options:["Reducir costos","Eliminar la competencia","Sustituir la estrategia","Adaptar la organización a nuevas condiciones"],correct:3,difficulty:"hard",justification:"La gestión del cambio busca preparar y acompañar a la organización en procesos de transformación, logrando que las personas los adopten de manera efectiva."},
  {text:"Una empresa diseña políticas para descuentos máximos, niveles de autorización para inversiones y criterios de selección de proveedores. ¿Qué función principal cumplen estas políticas en la implementación estratégica?",options:["Limitar la innovación","Sustituir objetivos","Eliminar riesgos","Orientar la toma de decisiones"],correct:3,difficulty:"medium",justification:"Las políticas organizacionales establecen directrices generales que guían el comportamiento y la toma de decisiones dentro de la empresa."},
  {text:"Durante la formulación estratégica, la alta dirección quiere asegurarse de que los objetivos SMART estén alineados con los factores clave de éxito. ¿Cuál es el enfoque más adecuado para lograr esta alineación?",options:["En decisiones improvisadas","Solo en metas financieras","Sin análisis previo","En el análisis FODA"],correct:3,difficulty:"hard",justification:"El análisis FODA permite identificar fortalezas, debilidades, oportunidades y amenazas, garantizando que los objetivos sean realistas y coherentes con el entorno."},
  {text:"Durante un taller de formulación estratégica avanzada, se discute la diferencia entre misión y visión. ¿Cuál de las siguientes afirmaciones refleja mejor el papel de la visión?",options:["Actividades diarias","Normas internas","Presupuesto","Futuro deseado de la organización"],correct:3,difficulty:"medium",justification:"La visión describe el estado futuro al que aspira la organización. Sirve como elemento motivador y orientador que guía la toma de decisiones estratégicas a largo plazo."},
  {text:"En la etapa de valoración dentro de un proceso de planificación estratégica, ¿qué actividad agrega más valor para preparar un buen Cuadro de Mando Integral (CMI)?",options:["Reducir costos","Eliminar procesos","Cambiar estructura","Medir el cumplimiento de objetivos"],correct:3,difficulty:"medium",justification:"Los indicadores permiten cuantificar el desempeño de la organización en relación con los objetivos estratégicos, facilitando la toma de decisiones basada en datos."},
  {text:"¿Cuál es el propósito principal de los planes de acción derivados del Cuadro de Mando Integral (CMI)?",options:["Sustituir la misión","Eliminar control","Reducir costos automáticamente","Convertir objetivos en acciones concretas"],correct:3,difficulty:"medium",justification:"Los planes de acción traducen los objetivos estratégicos en actividades específicas, asignando responsables, recursos y plazos."},
  {text:"En un sistema de control basado en el CMI, ¿qué característica distingue al control estratégico de un simple control operativo?",options:["Controlar tareas diarias","Medir solo gastos","Evitar el uso de indicadores","Evaluar el cumplimiento de los objetivos estratégicos"],correct:3,difficulty:"medium",justification:"El control estratégico se enfoca en verificar si la organización está avanzando hacia el logro de sus objetivos a largo plazo."},
  {text:"¿Cuál de las siguientes afirmaciones describe mejor la perspectiva financiera en el Cuadro de Mando Integral (CMI)?",options:["Satisfacción del cliente","Procesos internos","Cultura organizacional","Rentabilidad económica"],correct:3,difficulty:"easy",justification:"La perspectiva financiera evalúa los resultados económicos de la empresa, como ingresos, costos, utilidades y rentabilidad."},
  {text:"En la perspectiva del cliente del CMI, ¿qué tipo de indicador es más coherente con su propósito?",options:["Costos","Procesos","Inventarios","Satisfacción del cliente"],correct:3,difficulty:"easy",justification:"Esta perspectiva se enfoca en evaluar cómo los clientes perciben a la empresa, considerando calidad, servicio, fidelización y valor ofrecido."},
  {text:"¿Cuál es el enfoque central de la perspectiva de procesos internos en el CMI?",options:["Reducir salarios","Cambiar visión","Analizar política","Mejorar la eficiencia de procesos"],correct:3,difficulty:"medium",justification:"Esta perspectiva analiza los procesos clave de la organización con el objetivo de optimizarlos para ofrecer mejores productos o servicios."},
  {text:"¿Qué aspecto caracteriza principalmente a la perspectiva de aprendizaje y crecimiento en el CMI?",options:["Costos","Impuestos","Proveedores","Innovación y talento humano"],correct:3,difficulty:"medium",justification:"Esta perspectiva se enfoca en el desarrollo del capital humano, la innovación y la capacidad de adaptación de la empresa."},
  {text:"¿Qué función principal cumple el mapa estratégico dentro del enfoque del Cuadro de Mando Integral?",options:["Presupuesto","Indicadores","Organigrama","Relación causa-efecto entre objetivos"],correct:3,difficulty:"medium",justification:"El mapa estratégico muestra cómo los objetivos de las diferentes perspectivas del CMI se conectan entre sí mediante relaciones de causa y efecto."},
  {text:"En el análisis de desarrollo organizacional asociado al CMI, ¿qué aspecto resulta más relevante evaluar?",options:["Infraestructura","Ventas","Edificio","Cultura y capacidades organizacionales"],correct:3,difficulty:"medium",justification:"El desarrollo organizacional busca mejorar la cultura, el clima laboral y las capacidades del talento humano."},
  {text:"Durante la etapa de evaluación previa al diseño del CMI, ¿qué herramienta o enfoque es más útil para identificar fortalezas y debilidades internas?",options:["Balance general","Organigrama","Publicidad","Análisis FODA"],correct:3,difficulty:"medium",justification:"El análisis FODA es una herramienta estratégica que permite evaluar tanto factores internos como externos de la organización."},
  {text:"¿Cuáles de las siguientes afirmaciones describen mejor la relación entre el CMI y el control de gestión?",options:["Eliminar la estrategia","Controlar únicamente las finanzas","Sustituir la misión","Traducir la estrategia en indicadores medibles"],correct:3,difficulty:"medium",justification:"El CMI convierte la estrategia en objetivos concretos e indicadores que pueden ser medidos y evaluados."},
  {text:"Cuando se diseñan planes de acción vinculados a la perspectiva del cliente, ¿qué criterio es más importante para seleccionar las acciones prioritarias?",options:["Costos operativos","Procesos internos","Infraestructura","Satisfacción del cliente"],correct:3,difficulty:"easy",justification:"Esta perspectiva mide cómo los clientes perciben a la empresa, evaluando calidad, servicio, fidelización y valor entregado."},
  {text:"¿Qué característica distingue a un indicador bien definido dentro de un CMI?",options:["Generales y ambiguos","Sin relación con objetivos","Opcionales","Claros y medibles"],correct:3,difficulty:"medium",justification:"Los indicadores deben permitir evaluar de manera objetiva el desempeño. Si no son claros ni medibles, no cumplen su función de control."},
  {text:"En la construcción del mapa estratégico, ¿qué se busca al conectar objetivos de la perspectiva de aprendizaje y crecimiento con los procesos internos?",options:["Ninguna relación","Se sustituyen mutuamente","Se eliminan entre sí","El talento mejora la eficiencia de los procesos"],correct:3,difficulty:"hard",justification:"El talento humano es el encargado de ejecutar los procesos. Cuando el personal está capacitado y motivado, los procesos se desarrollan de manera más eficiente."},
  {text:"En el contexto del CMI, ¿qué propósito cumple el análisis periódico de resultados en la etapa de control?",options:["Eliminar objetivos","Evitar la planificación","Reducir personal","Detectar y corregir desviaciones"],correct:3,difficulty:"medium",justification:"El control estratégico permite comparar los resultados obtenidos con los objetivos planteados para tomar acciones correctivas."},
  {text:"Al diseñar objetivos para la perspectiva financiera del CMI, ¿qué enfoque es más coherente con la lógica del modelo?",options:["Indicadores de cliente","Indicadores operativos","Indicadores sociales","Indicadores financieros"],correct:3,difficulty:"easy",justification:"Estos indicadores permiten evaluar el desempeño económico de la empresa, incluyendo variables como ingresos, costos, utilidades y rentabilidad."},
  {text:"En la perspectiva de procesos internos, ¿qué define mejor la razón de ser actual de una organización?",options:["Definir el futuro","Sustituir la visión","Establecer normas","Definir la razón de ser de la organización en el presente"],correct:3,difficulty:"medium",justification:"La misión describe la razón de ser de la empresa en el momento actual, incluyendo su actividad principal, el público al que se dirige y el valor que ofrece."},
  {text:"En la perspectiva de aprendizaje y crecimiento, ¿qué enfoque refleja mejor el desarrollo continuo de la organización?",options:["Mantener errores","Reducir calidad","Eliminar clientes","Optimizar procesos constantemente"],correct:3,difficulty:"easy",justification:"La mejora continua implica un proceso sistemático orientado a perfeccionar constantemente las actividades de la organización, reducir errores y mejorar la calidad."},
  {text:"¿Qué representa mejor la integración entre el CMI y el análisis de desarrollo organizacional?",options:["Falta de liderazgo","Improvisación","Compromiso organizacional","Alineación y compromiso organizacional"],correct:3,difficulty:"hard",justification:"Se requiere una alineación general de toda la organización con los objetivos estratégicos, asegurando coherencia entre lo planificado y lo ejecutado."},
  {text:"En una agroindustria de cacao que busca implementar un CMI, ¿cuál sería el principal propósito de un plan de acción complejo en la etapa de valoración avanzada?",options:["Actuar sin dirección","Eliminar riesgos totalmente","Evitar decisiones","Definir objetivos y estrategias a largo plazo"],correct:3,difficulty:"easy",justification:"La planificación estratégica establece el rumbo de la organización, definiendo metas claras y las acciones necesarias para alcanzarlas."},
  {text:"En un esquema de control estratégico iterativo aplicado al CMI de una empresa de cacao, ¿qué caracteriza mejor el enfoque iterativo?",options:["Evaluar resultados continuamente y ajustar estrategias según el desempeño.","Aplicar una sola evaluación al final del proceso.","Ignorar cambios del entorno.","Mantener indicadores sin modificaciones."],correct:0,difficulty:"easy",justification:"El enfoque iterativo implica mejora continua y retroalimentación constante."},
  {text:"Al diseñar el CMI en una agroindustria de cacao, ¿cuál formulación de objetivo ilustra mejor la interrelación entre procesos internos y clientes?",options:["Mejorar la calidad del procesamiento para aumentar la satisfacción del cliente.","Reducir únicamente salarios administrativos.","Incrementar impuestos corporativos.","Cambiar el logotipo empresarial."],correct:0,difficulty:"medium",justification:"Refleja claramente la lógica de causa-efecto del CMI, donde las mejoras en procesos internos generan impacto directo en la perspectiva del cliente."},
  {text:"¿Qué mide la 'valoración previa' en un plan de acción del CMI?",options:["El estado inicial y la capacidad organizacional antes de implementar la estrategia.","Solo las ventas futuras.","Únicamente el presupuesto anual.","El número de oficinas disponibles."],correct:0,difficulty:"easy",justification:"La 'valoración previa' permite diagnosticar la situación actual de la organización antes de ejecutar el plan, incluyendo recursos, capacidades y procesos."},
  {text:"En control del CMI, si un proyecto está al 60% de la meta, ¿qué haces PRIMERO?",options:["Analizar las causas de la desviación y aplicar acciones correctivas.","Eliminar el proyecto inmediatamente.","Cambiar toda la estrategia sin análisis.","Ignorar el resultado obtenido."],correct:0,difficulty:"medium",justification:"Lo primero es entender por qué ocurre la desviación. Este análisis permite tomar decisiones informadas y aplicar acciones correctivas efectivas."},
  {text:"¿Por qué el CMI usa 4 perspectivas y no solo la financiera?",options:["Porque integra una visión equilibrada del desempeño organizacional.","Porque elimina la importancia de las finanzas.","Porque solo analiza clientes.","Porque reemplaza el análisis estratégico."],correct:0,difficulty:"easy",justification:"El CMI considera finanzas, clientes, procesos y aprendizaje para una visión integral y equilibrada del desempeño organizacional."},
  {text:"En la agroindustria de cacao, ¿cuál es el indicador financiero PRINCIPAL del CMI?",options:["Rentabilidad y crecimiento de ingresos.","Número de empleados capacitados.","Tiempo de respuesta al cliente.","Nivel de satisfacción laboral."],correct:0,difficulty:"medium",justification:"En la perspectiva financiera del CMI, los indicadores principales miden la creación de valor económico: rentabilidad y crecimiento de ingresos."},
  {text:"¿Qué falta en un mapa estratégico con solo dos flechas ('EBITDA ← NPS')?",options:["Las relaciones completas entre todas las perspectivas estratégicas.","Únicamente el logotipo empresarial.","Los nombres de los empleados.","El organigrama financiero."],correct:0,difficulty:"hard",justification:"Un mapa estratégico del CMI debe mostrar una red completa de relaciones causa-efecto entre todas las perspectivas, no solo una conexión aislada."},
  {text:"Los empleados NO quieren usar una nueva tecnología (60% vs 100% esperado). ¿Qué haces?",options:["Capacitar, comunicar beneficios y gestionar el cambio organizacional.","Obligar sin explicación alguna.","Eliminar toda la tecnología.","Ignorar la resistencia del personal."],correct:0,difficulty:"medium",justification:"La resistencia al cambio se supera con capacitación, comunicación y alineación cultural, no imponiendo cambios sin preparación."},
  {text:"¿Qué mide BIEN la perspectiva de aprendizaje en el CMI?",options:["Desarrollo de competencias, innovación y capacitación del personal.","Solo ingresos financieros.","Cantidad de oficinas corporativas.","Número de productos almacenados."],correct:0,difficulty:"hard",justification:"La perspectiva de aprendizaje y crecimiento mide las habilidades del talento humano, la innovación y el uso de tecnología como base para mejorar procesos y lograr resultados estratégicos."}
];

// ── UTILIDADES ───────────────────────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getLeaderboard(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score, lastPoints: p.lastPoints }));
}

// ── GAME LOGIC ───────────────────────────────────────────────────────────────
function showQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const q = room.questions[room.currentQ];
  room.state = 'question';
  room.questionStartTime = Date.now();
  room.answeredCount = 0;

  // Shuffle options on server so all players see same order
  const order = shuffleArray([0, 1, 2, 3]);
  const shuffledOptions = order.map(i => q.options[i]);
  room.currentShuffledCorrect = order.indexOf(q.correct);

  // Reset player state
  room.players.forEach(p => { p.answered = false; p.lastPoints = 0; p.lastCorrect = false; });

  io.to(roomCode).emit('show-question', {
    questionNum: room.currentQ + 1,
    totalQuestions: room.questions.length,
    text: q.text,
    options: shuffledOptions,
    difficulty: q.difficulty,
    timeLimit: room.timerPerQuestion,
    correctIndex: room.currentShuffledCorrect
  });

  room.timer = setTimeout(() => endQuestion(roomCode), room.timerPerQuestion * 1000);
}

function endQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.state !== 'question') return;
  clearTimeout(room.timer);
  room.state = 'reveal';

  const q = room.questions[room.currentQ];
  const lb = getLeaderboard(room);
  const isLast = room.currentQ + 1 >= room.questions.length;

  io.to(roomCode).emit('question-ended', {
    correctIndex: room.currentShuffledCorrect,
    justification: q.justification,
    leaderboard: lb,
    revealTime: REVEAL_TIME,
    isLast
  });

  // Auto-advance after REVEAL_TIME seconds
  room.revealTimer = setTimeout(() => nextQuestion(roomCode), REVEAL_TIME * 1000);
}

function nextQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.state !== 'reveal') return;
  clearTimeout(room.revealTimer);
  room.currentQ++;
  if (room.currentQ >= room.questions.length) {
    endGame(roomCode);
  } else {
    showQuestion(roomCode);
  }
}

function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.state = 'finished';
  const lb = getLeaderboard(room);
  io.to(roomCode).emit('game-over', { leaderboard: lb });
  setTimeout(() => rooms.delete(roomCode), 120000);
}

// ── SOCKET EVENTS ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create-room', ({ hostName, numQuestions, timerPerQuestion }) => {
    let code;
    do { code = generateCode(); } while (rooms.has(code));

    const count = Math.min(parseInt(numQuestions) || 10, ALL_QUESTIONS.length);
    const timer = Math.min(Math.max(parseInt(timerPerQuestion) || 20, 5), 120);
    const selectedQ = shuffleArray(ALL_QUESTIONS).slice(0, count);

    const room = {
      code,
      host: socket.id,
      hostName,
      players: new Map(),
      state: 'lobby',
      currentQ: 0,
      questions: selectedQ,
      questionStartTime: 0,
      answeredCount: 0,
      currentShuffledCorrect: 0,
      timerPerQuestion: timer,
      timer: null,
      revealTimer: null
    };

    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.isHost = true;
    socket.playerName = hostName;

    socket.emit('room-created', { code, numQuestions: count, timerPerQuestion: timer });
  });

  socket.on('join-room', ({ code, playerName }) => {
    const upperCode = code.toUpperCase().trim();
    const room = rooms.get(upperCode);
    if (!room) return socket.emit('join-error', 'Sala no encontrada. Verifica el código.');
    if (room.state !== 'lobby') return socket.emit('join-error', 'El juego ya comenzó. Intenta en la próxima ronda.');
    if (room.players.size >= 20) return socket.emit('join-error', 'La sala está llena (máx. 20 jugadores).');

    const name = playerName.trim().slice(0, 20);
    // Check duplicate names
    const taken = [...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase());
    if (taken) return socket.emit('join-error', 'Ese nombre ya está en uso. Elige otro.');

    room.players.set(socket.id, {
      id: socket.id, name, score: 0, answered: false, lastPoints: 0, lastCorrect: false
    });

    socket.join(upperCode);
    socket.roomCode = upperCode;
    socket.isHost = false;
    socket.playerName = name;

    const playerList = [...room.players.values()].map(p => ({ id: p.id, name: p.name }));
    socket.emit('room-joined', { code: upperCode, hostName: room.hostName, playerList });
    io.to(room.host).emit('player-joined', { id: socket.id, name, playerList });
    socket.to(upperCode).emit('player-list-update', playerList);
  });

  socket.on('start-game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;
    if (room.players.size < 1) return socket.emit('start-error', 'Necesitas al menos 1 jugador para iniciar.');

    room.state = 'playing';
    io.to(socket.roomCode).emit('game-started', { totalQuestions: room.questions.length });
    setTimeout(() => showQuestion(socket.roomCode), 1500);
  });

  socket.on('submit-answer', ({ answerIndex }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.state !== 'question') return;

    const player = room.players.get(socket.id);
    if (!player || player.answered) return;

    player.answered = true;
    room.answeredCount++;

    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    const correct = answerIndex === room.currentShuffledCorrect;
    let points = 0;
    if (correct) {
      const speedBonus = Math.max(0, (room.timerPerQuestion - elapsed) / room.timerPerQuestion);
      points = Math.round(1000 + speedBonus * 1000);
    }
    player.score += points;
    player.lastPoints = points;
    player.lastCorrect = correct;

    socket.emit('answer-received', { correct, points });

    // Notify host about progress
    io.to(room.host).emit('answer-progress', {
      answered: room.answeredCount,
      total: room.players.size
    });

    // Auto-end if all answered
    if (room.answeredCount >= room.players.size) {
      clearTimeout(room.timer);
      endQuestion(socket.roomCode);
    }
  });

  socket.on('skip-reveal', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id || room.state !== 'reveal') return;
    clearTimeout(room.revealTimer);
    nextQuestion(socket.roomCode);
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (socket.isHost) {
      io.to(code).emit('host-disconnected');
      clearTimeout(room.timer);
      clearTimeout(room.revealTimer);
      rooms.delete(code);
    } else {
      room.players.delete(socket.id);
      const playerList = [...room.players.values()].map(p => ({ id: p.id, name: p.name }));
      io.to(room.host).emit('player-joined', { id: socket.id, name: socket.playerName, playerList });
      socket.to(code).emit('player-list-update', playerList);

      if (room.state === 'question') {
        room.answeredCount = [...room.players.values()].filter(p => p.answered).length;
        if (room.players.size > 0 && room.answeredCount >= room.players.size) {
          clearTimeout(room.timer);
          endQuestion(code);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎯 ¿Quién Quiere Ser Millonario? — Servidor corriendo`);
  console.log(`   Abre tu navegador en: http://localhost:${PORT}\n`);
});
