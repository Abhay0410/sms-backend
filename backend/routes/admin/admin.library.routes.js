import express from 'express';
import { 
  addBook, getInventory, updateBook, deleteBook, issueBook, 
  returnBook, getLibraryStats, getRecentTransactions 
} from '../../controllers/admin/admin.library.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();

router.use(requireAuth(['admin'])); 

router.post('/books', addBook);
router.get('/inventory', getInventory);
router.put('/books/:id', updateBook);
router.delete('/books/:id', deleteBook);
router.post('/issue', issueBook);
router.post('/return', returnBook);
router.get('/stats', getLibraryStats);
router.get('/recent', getRecentTransactions);

export default router;