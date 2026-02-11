export const getFeedback = (sessionData) => {
    const { netDuration: tiempo_estudio_min_ms, grossDuration: duracion_total_min_ms, interruptions } = sessionData;

    // Convert ms to minutes for logic
    const tiempo_estudio_min = tiempo_estudio_min_ms / 60000;
    const duracion_total_min = duracion_total_min_ms / 60000;
    const tiempo_interrupcion_min = (duracion_total_min_ms - tiempo_estudio_min_ms) / 60000;
    const cantidad_interrupciones = interruptions ? interruptions.length : 0;

    // 2. CALCULAR CONCENTRACIÓN
    let concentracion = 0;
    if (duracion_total_min > 0) {
        concentracion = tiempo_estudio_min / duracion_total_min;
    } else {
        concentracion = 1;
    }

    // 3. METRICAS RELATIVAS (NUEVO)
    const horas_total = duracion_total_min / 60;
    const pausas_por_hora = horas_total > 0 ? cantidad_interrupciones / horas_total : quantidade_interrupciones;
    const ratio_pausa = tiempo_interrupcion_min / duracion_total_min;

    // 3b. PROMEDIO PAUSA
    let duracion_prom_interrupcion = 0;
    if (cantidad_interrupciones > 0) {
        duracion_prom_interrupcion = tiempo_interrupcion_min / cantidad_interrupciones;
    }

    // 4. CLASIFICAR CONCENTRACIÓN (Lenient)
    let concentracion_tipo = "baja";
    // If session is very long (>90m), accept slightly lower concentration as "Alta" (fatigue is normal)
    const thresholdAlta = duracion_total_min > 90 ? 0.70 : 0.75;

    if (concentracion >= thresholdAlta) concentracion_tipo = "alta";
    else if (concentracion >= 0.50) concentracion_tipo = "media";

    // 5. CLASIFICAR DURACIÓN
    let duracion_tipo = "larga";
    if (duracion_total_min < 25) duracion_tipo = "corta";
    else if (duracion_total_min <= 75) duracion_tipo = "media";

    // 6. CLASIFICAR CANTIDAD DE INTERRUPCIONES (Dinámico)
    let cantidad_interrupciones_tipo = "muchas";
    let limitPocas = 3;

    // Allow more interruptions if session is long
    if (duracion_total_min > 90) limitPocas = 6;
    else if (duracion_total_min > 50) limitPocas = 4;

    if (cantidad_interrupciones === 0) cantidad_interrupciones_tipo = "ninguna";
    else if (cantidad_interrupciones <= limitPocas) cantidad_interrupciones_tipo = "pocas";

    // 7. CLASIFICAR INTENSIDAD (Relativo)
    let interrupcion_intensidad = "largas";

    // Accept longer breaks if session is long (e.g. lunch break)
    let limitLeves = 2.5;
    let limitMedias = 6;

    if (duracion_total_min > 120) { // > 2 hours
        limitLeves = 5;
        limitMedias = 15;
    } else if (duracion_total_min > 60) {
        limitLeves = 4;
        limitMedias = 10;
    }

    if (cantidad_interrupciones === 0) interrupcion_intensidad = "ninguna";
    else if (duracion_prom_interrupcion <= limitLeves) interrupcion_intensidad = "leves";
    else if (duracion_prom_interrupcion <= limitMedias) interrupcion_intensidad = "medias";


    // 8. DECISIÓN DE TIPO DE FRASE
    let frase_tipo = "distraida";

    // Is it a "Marathon"?
    const isMarathon = duracion_total_min > 90;

    if (concentracion_tipo === "alta") {
        // High concentration is almost always excellent/very good
        if (interrupcion_intensidad !== "largas") frase_tipo = "excelente";
        else frase_tipo = "muy_buena"; // Even with long breaks, high conc is good
    }
    else if (concentracion_tipo === "media") {
        // If marathon, media concentration is actually quite good
        if (isMarathon && ratio_pausa < 0.3) frase_tipo = "muy_buena";
        else if (isMarathon) frase_tipo = "buena_con_detalles";
        else if (interrupcion_intensidad !== "largas") frase_tipo = "buena_con_detalles";
        else frase_tipo = "regular";
    }
    else { // Baja
        // If marathon, it's likely fatigue
        if (isMarathon) frase_tipo = "fatiga";
        else frase_tipo = "distraida";
    }

    // ... (rest of phrases) ...
    // Update suggestion logic to be smarter about long sessions
    let sugerencia = null;
    if (duracion_total_min > 90 && concentracion_tipo === "baja") sugerencia = "Para sesiones largas, usá Pomodoro.";
    else if (interrupcion_intensidad === "largas" && !isMarathon) sugerencia = "Intentá acortar los descansos.";
    else if (cantidad_interrupciones_tipo === "muchas" && interrupcion_intensidad === "leves") sugerencia = "Evitá las micro-interrupciones constantes.";

    const frases = {
        excelente: [
            "Sesión muy sólida, mantuviste un excelente nivel de concentración.",
            "Estudio fluido y enfocado durante casi toda la sesión.",
            "Muy buen control del tiempo y la atención.",
            "Sesión altamente productiva, bien aprovechada.",
            "Rendiste a un nivel muy alto en esta sesión."
        ],
        muy_buena: [
            "Muy buena sesión, con algunos descansos necesarios.",
            "Buen enfoque general a lo largo del estudio.",
            "Sesión consistente, gestionaste bien el tiempo.", // Adjusted text
            "Buen rendimiento global.",
            "Estudio efectivo durante la mayor parte del tiempo."
        ],
        buena_con_detalles: [
            "Buena sesión, con pausas normales para el tiempo estudiado.",
            "Rendimiento positivo, el descanso es parte del proceso.",
            "Estudiaste bien, manteniendo un ritmo sostenible.",
            "Sesión correcta, aunque con intermitencias.",
            "Buen trabajo, equilibrando estudio y pausas."
        ],
        regular: [
            "Sesión aceptable, pero costó retomar el ritmo.",
            "Rendimiento promedio, muchas pausas para el tiempo total.",
            "Hubo avances, aunque la concentración fluctuó.",
            "Sesión normal, con varios altibajos.",
            "El estudio fue algo intermitente hoy."
        ],
        fatiga: [
            "Sesión muy larga, es normal sentir cansancio al final.",
            "Mucho tiempo invertido, pero la fatiga afectó el foco.",
            "Probablemente el cansancio acumulado pesó en la sesión.",
            "Gran esfuerzo por la duración, aunque bajó la intensidad.",
            "Sesión maratónica, recordá descansar bien."
        ],
        distraida: [
            "Costó mantener la atención durante la sesión.",
            "Las distracciones superaron al tiempo de foco.",
            "Sesión dispersa, intentá eliminar estímulos externos.",
            "Fue difícil sostener el hilo hoy.",
            "El ritmo de estudio se cortó demasiado."
        ]
    };

    const lista = frases[frase_tipo] || frases["distraida"];
    const frase_final = lista[Math.floor(Math.random() * lista.length)];

    return {
        concentracion: Math.round(concentracion * 100),
        concentracion_tipo,
        frase: frase_final,
        sugerencia,
        tiempo_estudio_min: Math.round(tiempo_estudio_min),
        duracion_total_min: Math.round(duracion_total_min),
        tiempo_interrupcion_min: Math.round(tiempo_interrupcion_min),
        cantidad_interrupciones
    };
};
