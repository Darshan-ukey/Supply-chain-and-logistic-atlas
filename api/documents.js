import {createRouter} from '../lib/api/_router.js';
import handler0 from '../lib/api/documents.js';
import handler1 from '../lib/api/document-ingest.js';
import handler2 from '../lib/api/document-facts.js';
import handler3 from '../lib/api/evidence-upload.js';
import handler4 from '../lib/api/session-document-ingest.js';
import handler5 from '../lib/api/session-fact-confirm.js';
export default createRouter('documents',{'documents':handler0,'document-ingest':handler1,'document-facts':handler2,'evidence-upload':handler3,'session-document-ingest':handler4,'session-fact-confirm':handler5});
