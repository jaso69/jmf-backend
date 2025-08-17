const axios = require('axios');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Inicializar almacenamiento global de sesiones (persistirá entre invocaciones mientras Vercel no reinicie)
const conversations = new Map();

module.exports = async (req, res) => {
  // Configurar encabezados CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY no está definida' });
  }

const { 
    prompt, 
    stream = false, 
    conversationId = null, 
    clearHistory = false 
  } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "El campo 'prompt' es requerido." });
  }

  try {

    let conversationMessages = [];
    let currentConversationId = conversationId;

    // Si se proporciona un ID de conversación, recuperar el historial
    if (currentConversationId && conversations.has(currentConversationId)) {
      conversationMessages = conversations.get(currentConversationId);
    } else if (!currentConversationId) {
      // Generar un nuevo ID de conversación
      currentConversationId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Limpiar historial si se solicita
    if (clearHistory) {
      conversationMessages = [];
    }

    // Agregar el mensaje del usuario al historial
    conversationMessages.push({
      role: "user",
      content: prompt
    });
    // Configuración para streaming
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: `
                Eres un asistente virtual de JMF Ortiz, 
                una administración de fincas con más de 40 años de experiencia en la gestión de comunidades de propietarios en España.
                Tu objetivo es responder de manera precisa, profesional y clara a preguntas relacionadas con la Ley de Propiedad Horizontal de España
                y temas sobre comunidades de vecinos, como gestión de conflictos, mantenimiento, obligaciones legales, juntas de propietarios, cuotas, obras, entre otros. 
                Utiliza un tono amable, confiable y profesional, reflejando la experiencia y compromiso de JMF Ortiz con la transparencia y la satisfacción de los clientes. 
                Si la pregunta requiere información específica (como casos concretos o datos no proporcionados), sugiere consultar con un administrador de JMF Ortiz para una respuesta personalizada.
                Proporciona respuestas concisas, pero completas, y utiliza ejemplos prácticos cuando sea relevante. 
                Si no estás seguro de la respuesta o el tema excede tu conocimiento, indica que se derivará la consulta a un experto de JMF Ortiz. 
                Todas las respuestas deben basarse en la legislación española vigente, específicamente la Ley de Propiedad Horizontal (Ley 49/1960, con sus modificaciones, como la de 2022), y en las mejores prácticas de gestión de comunidades. 
                No inventes información ni hagas suposiciones sobre casos específicos sin datos claros.
                El telefono de contacto es +34 91 656 55 12 y el correo electrónico es info@jmfortiz.com
                La dirección de JMF Ortiz es C/ Hilados numero 20, escalera izquierda Bajo B, 28850 Torrejon de Ardoz, Madrid.
                Siempre que des la dirección postal, no abrevies, siempre debe ser completa.
                Responde solo con texto plano, no incluyas ** ni caracteres que dificulten la lectura, no uses markdown. y con los emoticonos justos para que el cliente pueda entender mejor tu respuesta.
              `
            },
            ...conversationMessages
          ],
          temperature: 0.3,
          stream: true
        },
        {
          headers: {
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream'
        }
      );

      let assistantResponse = "";

      response.data.on("data", (chunk) => {
        const lines = chunk.toString().split("\n").filter(line => line.startsWith("data: "));
        for (const line of lines) {
          const data = line.replace("data: ", "");
          if (data === "[DONE]") {
            // Guardamos la respuesta en historial
            conversationMessages.push({ role: "assistant", content: assistantResponse });
            global.chatSessions[sessionId] = conversationMessages;
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0].delta.content || "";
            assistantResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          } catch (e) {
            // Ignorar errores de parseo
          }
        }
      });

      response.data.on("error", (error) => {
        console.error("Error en stream:", error);
        res.write(`data: ${JSON.stringify({ error: "Error en stream" })}\n\n`);
        res.end();
      });

      return;
    }

    // Respuesta no streaming
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `
              Eres un asistente virtual de JMF Ortiz, con más de 40 años de experiencia en la gestión de comunidades.
              Responde en base a la Ley de Propiedad Horizontal en España y mejores prácticas, de forma clara y profesional.
            `
          },
          ...conversationMessages
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const assistantResponse = response.data.choices[0].message.content;

    // Actualizar historial
    conversationMessages.push({ role: "assistant", content: assistantResponse });
    global.chatSessions[sessionId] = conversationMessages;

    res.status(200).json({ content: assistantResponse });
  } catch (error) {
    console.error('Error al llamar a DeepSeek:', error.response?.data || error.message);
    res.status(500).json({
      error: "Error al procesar la solicitud",
      details: error.response?.data || error.message,
    });
  }
};
