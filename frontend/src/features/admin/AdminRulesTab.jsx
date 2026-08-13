import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { API_URL } from '../../config';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import FormattedContent from '../../components/FormattedContent';

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'code-block', 'blockquote'],
    [{ 'color': [] }, { 'background': [] }],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'indent',
  'link', 'code-block', 'blockquote',
  'color', 'background'
];

export default function AdminRulesTab() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState(null);

  const [formData, setFormData] = useState({
    title: 'Hackathon Rules & Regulations',
    content: ''
  });

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    const hasRule = rules.length > 0;
    if (!hasRule || isEditing) {
      const timer = setTimeout(() => {
        const tooltips = {
          '.ql-header': 'Heading Level / Text Style',
          '.ql-bold': 'Bold (Ctrl+B)',
          '.ql-italic': 'Italic (Ctrl+I)',
          '.ql-underline': 'Underline (Ctrl+U)',
          '.ql-strike': 'Strikethrough',
          '.ql-list[value="ordered"]': 'Numbered List',
          '.ql-list[value="bullet"]': 'Bullet List',
          '.ql-indent[value="-1"]': 'Decrease Indent',
          '.ql-indent[value="+1"]': 'Increase Indent',
          '.ql-link': 'Insert Link (Ctrl+K)',
          '.ql-code-block': 'Code Block',
          '.ql-blockquote': 'Blockquote',
          '.ql-color': 'Text Color',
          '.ql-background': 'Highlight / Background Color',
          '.ql-clean': 'Clear All Formatting',
        };

        Object.entries(tooltips).forEach(([selector, title]) => {
          const elements = document.querySelectorAll(`.quill-editor-container ${selector}`);
          elements.forEach(el => el.setAttribute('title', title));
        });

        const headerLabels = document.querySelectorAll('.quill-editor-container .ql-header .ql-picker-label');
        headerLabels.forEach(el => el.setAttribute('title', 'Heading Level / Text Style'));
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [rules.length, isEditing]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/rules`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setRules(data.data || []);
      }
    } catch (error) {
      toast.error('Failed to load rules and regulations');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    const rule = rules[0];
    if (rule) {
      setFormData({
        title: rule.title || 'Hackathon Rules & Regulations',
        content: rule.content || ''
      });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const cleanPastedHtml = (html) => {
    if (!html) return '';
    return html
      .replace(/color:\s*(?:rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|#[0-9a-fA-F]{3,6}|black|windowtext|inherit)\s*!?\s*important?;?/gi, (match) => {
        if (/rgb\(\s*(?:230|255|0|153)\s*,\s*(?:0|153|255|138|102|51)\s*,\s*(?:0|204|255)\s*\)/i.test(match)) {
          return match;
        }
        return '';
      })
      .replace(/background-color:\s*(?:rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|#ffffff|#fff|white|transparent)\s*!?\s*important?;?/gi, '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title || 'Hackathon Rules & Regulations',
        content: cleanPastedHtml(formData.content)
      };

      const rule = rules.length > 0 ? rules[0] : null;

      if (rule) {
        const res = await fetch(`${API_URL}/api/v1/rules/admin/${rule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update rules');
        toast.success('Rules & Regulations updated successfully');
      } else {
        const res = await fetch(`${API_URL}/api/v1/rules/admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to publish rules');
        toast.success('Rules & Regulations published successfully');
      }

      setIsEditing(false);
      fetchRules();
    } catch (error) {
      toast.error(error.message || 'Failed to save rules');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id) => {
    setDeletingRuleId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingRuleId) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${API_URL}/api/v1/rules/admin/${deletingRuleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Rules & Regulations cleared');
        setIsDeleteModalOpen(false);
        setDeletingRuleId(null);
        setRules([]);
      } else {
        toast.error(data.message || 'Failed to clear rules');
      }
    } catch (error) {
      toast.error('Error clearing rules');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasRule = rules.length > 0;
  const rule = hasRule ? rules[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Rules & Regulations</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage the official hackathon rules and regulations for all participants.</p>
        </div>
      </div>

      {(!hasRule || isEditing) ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
            {hasRule ? 'Edit Rules & Regulations' : 'Publish Rules & Regulations'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 px-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Hackathon Rules & Regulations"
                required
              />
            </div>

            <div className="quill-editor-container bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 px-1">
                Rules & Regulations (Rich Formatting & Copy-Paste Supported)
              </label>
              <ReactQuill
                theme="snow"
                value={formData.content || ''}
                onChange={(value) => setFormData({ ...formData, content: value })}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Write or paste your rules and regulations here. Formatting (bold, headings, bullet points, numbering) will be preserved automatically..."
                className="min-h-[350px]"
              />
              <p className="text-xs text-slate-500 mt-2 px-1 font-medium">
                💡 Tip: You can copy and paste directly from Word, Google Docs, or PDF — all bolding, bullet points, headings, and tables will be preserved!
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              {hasRule && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {hasRule ? 'Save Changes' : 'Publish Rules & Regulations'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-6 sm:p-8 flex-1 w-full max-w-full overflow-hidden">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 break-words">{rule.title}</h3>
            <FormattedContent content={rule.content} />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              onClick={handleEdit}
              className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => confirmDelete(rule.id)}
              className="px-5 py-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-bold rounded-xl transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Clear Rules & Regulations?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Are you sure you want to clear the rules and regulations? This action cannot be undone. Users will see the default rules until new ones are published.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingRuleId(null);
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
