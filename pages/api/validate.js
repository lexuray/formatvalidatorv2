import formidable from 'formidable';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';
import { DOMParser } from 'xmldom';

// Disable body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the uploaded file
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);
    const file = files.document[0];

    if (!file || !file.originalFilename.endsWith('.docx')) {
      return res.status(400).json({ error: 'Please upload a .docx file' });
    }

    // Read and parse the DOCX file
    const fileBuffer = await fs.readFile(file.filepath);
    const validator = new APAValidator();
    const results = await validator.validateDocument(fileBuffer, file.originalFilename);

    // Clean up temp file
    await fs.unlink(file.filepath);

    res.status(200).json(results);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Failed to validate document' });
  }
}
