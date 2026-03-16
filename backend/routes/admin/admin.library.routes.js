import express from 'express';
import { 
  addBook, getInventory, updateBook, deleteBook, issueBook, 
  returnBook, getLibraryStats,getActiveIssues 
} from '../../controllers/admin/admin.library.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();

router.use(requireAuth(['admin'])); 

router.post('/books', addBook);
router.get('/inventory', getInventory);
router.put('/books/:id', updateBook);
router.delete('/books/:id', deleteBook);
router.get('/active-issues', getActiveIssues);
router.post('/issue', issueBook);
router.post('/return', returnBook);
router.get('/stats', getLibraryStats);

export default router;