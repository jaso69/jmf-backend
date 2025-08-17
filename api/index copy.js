const axios = require('axios');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

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

  const { prompt, stream = false } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "El campo 'prompt' es requerido." });
  }

  try {
    // Configuración para streaming
    if (stream) {
      // Configuramos los headers para streaming
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
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          stream: true // Habilitamos streaming en la API
        },
        {
          headers: {
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream' // Importante para manejar la respuesta como stream
        }
      );

      // Pipe la respuesta de DeepSeek directamente al cliente
      response.data.pipe(res);

      return;
    }

    // Código original para respuestas no streaming
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `
              para un chatbot con gpt-4 cuantas preguntas y respuestas puede responder con 10€
            `
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error al llamar a DeepSeek:', error.response?.data || error.message);
    res.status(500).json({
      error: "Error al procesar la solicitud",
      details: error.response?.data || error.message,
    });
  }
};