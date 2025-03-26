const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Credenciales de Kommo
const KOMMO_API_URL = 'https://your-subdomain.kommo.com/api/v4';
const KOMMO_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImU2NTFkMGQ1ODJmYThkMjM3NjEzMWE3ZGZhMzU1ZmUyNGU1MDYwOTVlNzZiZmNkOTEzNDlmZDEyNzAyZjY1MzkwN2QyYzQxZjNmZDcxZWM0In0.eyJhdWQiOiIyMGNmYWEwYS1mMTM3LTQ5ZTQtYTFmYy02OWVhZWFmODUzYmQiLCJqdGkiOiJlNjUxZDBkNTgyZmE4ZDIzNzYxMzFhN2RmYTM1NWZlMjRlNTA2MDk1ZTc2YmZjZDkxMzQ5ZmQxMjcwMmY2NTM5MDdkMmM0MWYzZmQ3MWVjNCIsImlhdCI6MTc0MjU4OTcwMSwibmJmIjoxNzQyNTg5NzAxLCJleHAiOjE3NTEyNDE2MDAsInN1YiI6Ijk5Mjk3MzkiLCJncmFudF90eXBlIjoiIiwiYWNjb3VudF9pZCI6MzE1NDQ4OTUsImJhc2VfZG9tYWluIjoia29tbW8uY29tIiwidmVyc2lvbiI6Miwic2NvcGVzIjpbImNybSIsImZpbGVzIiwiZmlsZXNfZGVsZXRlIiwibm90aWZpY2F0aW9ucyIsInB1c2hfbm90aWZpY2F0aW9ucyJdLCJoYXNoX3V1aWQiOiIxYWY3YWUxNC0xZjU4LTQ1ZjktODFkYy02YzI1YmNkNTM5ZWEiLCJhcGlfZG9tYWluIjoiYXBpLWcua29tbW8uY29tIn0.i91Mbv1RpPeec3uX7-DZ6mW7IqlM7crjoh5riRoYkoT_JgEai6PyWStdbskUNyrFPR_cS4I27zoi5QzOJ08xLI_c_qMBNeXulSfSGZAgDM4T-B5t5ipSbVQdFoxTidtY_YGQm7fBIoLf65pH2ah5LJX0lPSbB6RR9jcm9L0-y_VhlXu0LxCmYDr_yHXfPedxBB1fdF5NtUeGauOAtZGVfSnCzfCLdFYzHlsEgw6gKVhWxwEFdEmW2Zk_BspvUBn6epK8T89LlD1kRwmL7U6VJbUNgIIYRJQ4pEtdWD5PmQ4qxay2awVwXzYP0YL5BGeQsXreg9jzoselKQcMqnjuMw';

// Credenciales de ActiveCampaign
const ACTIVE_CAMPAIGN_API_URL = 'https://cefevzla.api-us1.com/api/3';
const ACTIVE_CAMPAIGN_API_KEY = '30b68b0af43613aeab64f5603fc14521fd68612f5c74b10a8f2071cb2e802e593a3bda0f';

app.post('/webhook', async (req, res) => {
    const { lead_id } = req.body;

    try {
        // Obtener información del lead desde Kommo
        const leadResponse = await axios.get(`${KOMMO_API_URL}/leads/${lead_id}`, {
            headers: {
                'Authorization': `Bearer ${KOMMO_TOKEN}`
            }
        });

        const lead = leadResponse.data;
        const stageName = lead.status_id;

        // Verificar si la etapa contiene la palabra "Email"
        if (stageName.includes('Email')) {
            // Obtener etiquetas del lead
            const tags = lead.tags.map(tag => tag.name);

            // Determinar el valor del campo "Querido/a" basado en las etiquetas
            let queridoValue = '';
            if (tags.includes('Femenino')) {
                queridoValue = 'Querida';
            } else if (tags.includes('Masculino')) {
                queridoValue = 'Querido';
            }

            // Crear contacto en ActiveCampaign
            const contactData = {
                contact: {
                    email: lead.custom_fields_values.find(field => field.code === 'EMAIL').values[0].value,
                    firstName: lead.name.split(' ')[0],
                    lastName: lead.name.split(' ')[1] || '',
                    fieldValues: [
                        {
                            field: '1', // ID del campo personalizado "Como le gusta que le llamen"
                            value: lead.custom_fields_values.find(field => field.code === 'CALL_NAME').values[0].value
                        },
                        {
                            field: '2', // ID del campo personalizado "Querido/a"
                            value: queridoValue
                        }
                    ]
                }
            };

            const contactResponse = await axios.post(`${ACTIVE_CAMPAIGN_API_URL}/contacts`, contactData, {
                headers: {
                    'Api-Token': ACTIVE_CAMPAIGN_API_KEY
                }
            });

            const contactId = contactResponse.data.contact.id;

            // Agregar contacto a la lista correspondiente en ActiveCampaign
            const listId = getListIdByStage(stageName);
            await axios.post(`${ACTIVE_CAMPAIGN_API_URL}/contactLists`, {
                contactList: {
                    list: listId,
                    contact: contactId,
                    status: 1
                }
            }, {
                headers: {
                    'Api-Token': ACTIVE_CAMPAIGN_API_KEY
                }
            });
        }

        res.status(200).send('Lead procesado correctamente');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al procesar el lead');
    }
});

function getListIdByStage(stageName) {
    // Mapear el nombre de la etapa al ID de la lista en ActiveCampaign
    const stageToListMap = {
        'Enviado Email-1 TOT': 1,
        'Enviado Email-2': 2,
        'Enviado Email-3': 3,
        'Reenviado Email-1 TOT': 4,
        'Enviado Email-6': 5,
        'Kit email de salida 1': 6,
        'Kit email de salida 2': 7,
        'Kit email de salida 3': 8,
        'Email spot logistica': 9,
        'Email SPOT Digital': 10,
        'Email Spot Venezuela': 11,
        'Email Spot EEUU': 12,
        'Email Spot España': 13,
        'Email Spot FACES': 14,
        'Email-4 Enviado': 15,
        'Email-5 Enviado': 16,
        'Email de Bienvenida': 17,
        'Email Recordatorio': 18
    };

    return stageToListMap[stageName] || 1; // Usar 1 como lista por defecto
}

app.listen(3000, () => console.log('Servidor escuchando en el puerto 3000'));
