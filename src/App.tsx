/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  Image as ImageIcon,
  Check,
  X,
  Loader2,
  Maximize,
  Minimize,
  Move,
  ZoomIn,
  ZoomOut,
  Share2,
  Home,
  ArrowLeft,
  Sparkles,
  Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { Template, UserProfile, EditorState } from './types';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          message = `Firestore ${parsed.operationType} failed: ${parsed.error}`;
        }
      } catch (e) {
        message = this.state.error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-neutral-200 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <X className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Application Error</h2>
            <p className="text-neutral-600">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'admin' | 'editor'>('home');
  const [loading, setLoading] = useState(true);
  const homePhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data() as UserProfile);
          } else if (currentUser.email === 'yapinailulmuna72@gmail.com') {
            // Fallback for the admin if the doc creation failed or is delayed
            setUserProfile({ email: currentUser.email, role: 'admin' });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          if (currentUser.email === 'yapinailulmuna72@gmail.com') {
            setUserProfile({ email: currentUser.email, role: 'admin' });
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Templates snapshot received, count:', snapshot.size);
      const templateList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Template[];
      setTemplates(templateList);
    }, (error) => {
      console.error('Error in templates onSnapshot:', error);
      handleFirestoreError(error, OperationType.GET, 'templates');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (view === 'admin' && userProfile?.role !== 'admin') {
      setView('home');
    }
  }, [view, userProfile]);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleHomePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserPhoto(reader.result as string);
      };
      reader.onerror = () => {
        alert('Gagal membaca file foto. Silakan coba lagi.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartEditing = () => {
    if (selectedTemplate && userPhoto) {
      setView('editor');
    } else if (!selectedTemplate) {
      alert('Silakan pilih bingkai terlebih dahulu.');
    } else if (!userPhoto) {
      alert('Silakan unggah foto Anda terlebih dahulu.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-emerald-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={() => { setView('home'); setSelectedTemplate(null); setUserPhoto(null); }}
            >
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 mr-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight leading-none">Twibbon Maker</span>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Bray boon profesional tool</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  {userProfile?.role === 'admin' && user.email === 'yapinailulmuna72@gmail.com' && (
                    <button 
                      onClick={() => setView('admin')}
                      className={cn(
                        "px-4 py-1.5 rounded-full font-bold text-sm transition-all",
                        view === 'admin' 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      )}
                    >
                      Admin
                    </button>
                  )}
                  <div className="flex items-center gap-2 bg-neutral-100 px-3 py-1.5 rounded-full">
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-white">
                      <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
                        alt="Profile" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-sm font-medium hidden sm:block">{user.displayName || user.email?.split('@')[0]}</span>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 rounded-full hover:bg-red-50 text-neutral-600 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button 
                  onClick={loginWithGoogle}
                  className="bg-emerald-600 text-white px-5 py-2 rounded-full font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center gap-2"
                >
                  <UserIcon className="w-4 h-4" />
                  Login with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Twibbon Maker</h1>
                <p className="text-emerald-600 font-bold text-xs tracking-widest uppercase">Bray boon profesional tool</p>
                <p className="text-neutral-500 text-sm">Buat twibbon kampanye Anda dengan mudah dan cepat</p>
              </div>

              <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-xl overflow-hidden">
                <div className="p-6 sm:p-8 space-y-8">
                  {/* Step 1: Select Template */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                      <h2 className="text-lg font-bold text-neutral-900">Pilih Bingkai</h2>
                    </div>
                    
                    {templates.length === 0 ? (
                      <div className="py-10 text-center bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
                        <p className="text-neutral-400 text-sm">Belum ada bingkai tersedia.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-200">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className={cn(
                              "relative aspect-square rounded-xl overflow-hidden border-2 transition-all group",
                              selectedTemplate?.id === template.id 
                                ? "border-emerald-600 ring-4 ring-emerald-100" 
                                : "border-neutral-100 hover:border-emerald-200"
                            )}
                          >
                            <img 
                              src={template.imageData} 
                              alt={template.name} 
                              className="w-full h-full object-contain bg-neutral-50 group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                            {selectedTemplate?.id === template.id && (
                              <div className="absolute inset-0 bg-emerald-600/20 flex items-center justify-center">
                                <div className="bg-emerald-600 text-white p-1.5 rounded-full shadow-lg">
                                  <Check className="w-4 h-4" />
                                </div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Upload Photo */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                      <h2 className="text-lg font-bold text-neutral-900">Unggah Foto Anda</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {userPhoto ? (
                        <div className={cn(
                          "relative rounded-2xl overflow-hidden border-2 border-emerald-100 bg-emerald-50 group mx-auto transition-all duration-500",
                          selectedTemplate?.size === '1080x1920' ? "aspect-[9/16] max-h-[400px]" : "aspect-square max-w-[300px]"
                        )}>
                          {/* User Photo */}
                          <div className="absolute inset-0">
                            <img src={userPhoto} alt="User Photo" className="w-full h-full object-cover" />
                          </div>
                          
                          {/* Template Overlay (if selected) */}
                          {selectedTemplate && (
                            <div className="absolute inset-0 pointer-events-none">
                              <img 
                                src={selectedTemplate.imageData} 
                                alt="Template Overlay" 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button 
                              onClick={() => homePhotoInputRef.current?.click()}
                              className="bg-white text-neutral-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-neutral-100 transition-all shadow-lg"
                            >
                              Ganti Foto
                            </button>
                            <button 
                              onClick={() => setUserPhoto(null)}
                              className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg"
                            >
                              Hapus
                            </button>
                          </div>
                          
                          {selectedTemplate && (
                            <div className="absolute bottom-3 left-3 right-3">
                              <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm border border-emerald-100/50 flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                Live Preview
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => homePhotoInputRef.current?.click()}
                          className="w-full py-10 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-neutral-500 font-bold hover:bg-neutral-100 hover:border-emerald-300 transition-all flex flex-col items-center gap-3 group"
                        >
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md text-neutral-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <span className="block text-lg">Pilih Foto Anda</span>
                            <span className="text-xs font-normal text-neutral-400">Klik untuk mengunggah foto dari galeri</span>
                          </div>
                        </button>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={homePhotoInputRef}
                      onChange={handleHomePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Step 3: Action */}
                  <div className="pt-4">
                    <button
                      onClick={handleStartEditing}
                      disabled={!selectedTemplate || !userPhoto}
                      className={cn(
                        "w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3",
                        selectedTemplate && userPhoto
                          ? "bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1"
                          : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      )}
                    >
                      <span>Buat Twibbon Sekarang</span>
                      <ArrowLeft className="w-6 h-6 rotate-180" />
                    </button>
                  </div>
                </div>

                <div className="bg-neutral-50 p-6 border-t border-neutral-100 text-center">
                  <p className="text-xs text-neutral-400">
                    {!selectedTemplate && !userPhoto && "Silakan pilih bingkai dan unggah foto untuk memulai."}
                    {!selectedTemplate && userPhoto && "Bagus! Sekarang pilih bingkai yang Anda inginkan."}
                    {selectedTemplate && !userPhoto && "Bingkai siap! Sekarang unggah foto Anda."}
                    {selectedTemplate && userPhoto && "Semua siap! Klik tombol di atas untuk mulai mengedit."}
                  </p>
                </div>
              </div>

              {/* Quick Admin Access (Hidden) */}
              {userProfile?.role === 'admin' && (
                <div className="flex justify-center">
                  <button 
                    onClick={() => setView('admin')}
                    className="text-neutral-300 hover:text-neutral-500 text-xs font-medium transition-colors"
                  >
                    Buka Panel Admin
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'admin' && userProfile?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col lg:flex-row gap-8"
            >
              {/* Admin Sidebar */}
              <div className="lg:w-64 flex-shrink-0 space-y-4">
                <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                  <h2 className="text-xl font-bold mb-6">Admin Panel</h2>
                  <nav className="space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold">
                      <Settings className="w-5 h-5" />
                      Templates
                    </button>
                    <button 
                      onClick={() => setView('home')}
                      className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-colors"
                    >
                      <Home className="w-5 h-5" />
                      Back to Site
                    </button>
                  </nav>
                </div>
                
                <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200">
                  <h4 className="font-bold mb-2">Need Help?</h4>
                  <p className="text-xs text-emerald-100 leading-relaxed">
                    Manage your templates here. You can upload new designs or remove old ones.
                  </p>
                </div>
              </div>

              {/* Admin Content */}
              <div className="flex-grow space-y-8">
                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                    <p className="text-sm font-medium text-neutral-500">Total Templates</p>
                    <p className="text-3xl font-black text-emerald-600">{templates.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                    <p className="text-sm font-medium text-neutral-500">Active Users</p>
                    <p className="text-3xl font-black text-emerald-600">1.2k</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                    <p className="text-sm font-medium text-neutral-500">Total Downloads</p>
                    <p className="text-3xl font-black text-emerald-600">8.4k</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Upload Form */}
                  <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Upload className="w-5 h-5 text-emerald-600" />
                      Upload New Template
                    </h3>
                    <UploadForm onUpload={() => {}} />
                  </div>

                  {/* Template Management */}
                  <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Settings className="w-5 h-5 text-emerald-600" />
                      Kelola Template ({templates.length})
                    </h3>
                    <AdminTemplateList templates={templates} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'editor' && selectedTemplate && (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <TwibbonEditor 
                template={selectedTemplate} 
                initialPhoto={userPhoto}
                onBack={() => { setView('home'); setSelectedTemplate(null); setUserPhoto(null); }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-10 border-t border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-neutral-500 text-sm">
            &copy; 2026 Twibbon Maker. Built with precision.
          </p>
        </div>
      </footer>
    </div>
  );
}

function UploadForm({ onUpload }: { onUpload: () => void }) {
  const [name, setName] = useState('');
  const [size, setSize] = useState<'1080x1080' | '1080x1920'>('1080x1080');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // Automatic compression/resizing for templates
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/png');
          
          // Check if still too large for Firestore (1MB limit)
          if (compressedBase64.length > 1048576) {
            console.warn('Compressed image still too large, reducing size further...');
            // Try even smaller if still too large
            const scale = Math.sqrt(1048576 / compressedBase64.length) * 0.9;
            canvas.width = Math.floor(width * scale);
            canvas.height = Math.floor(height * scale);
            const ctx2 = canvas.getContext('2d');
            ctx2?.drawImage(img, 0, 0, canvas.width, canvas.height);
            const finalBase64 = canvas.toDataURL('image/png');
            setPreview(finalBase64);
          } else {
            setPreview(compressedBase64);
          }
          setFile(selectedFile);
        };
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert('Anda harus login untuk mengunggah template.');
      return;
    }
    if (!name) {
      alert('Silakan masukkan nama template.');
      return;
    }
    if (!file || !preview) {
      alert('Silakan pilih gambar template.');
      return;
    }

    setUploading(true);
    try {
      console.log('Attempting to upload template:', { name, size });
      const docRef = await addDoc(collection(db, 'templates'), {
        name,
        size,
        imageData: preview,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser.uid
      });
      console.log('Template uploaded successfully with ID:', docRef.id);
      
      setName('');
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      onUpload();
      alert('Template berhasil diunggah!');
    } catch (error) {
      console.error('Error uploading template:', error);
      handleFirestoreError(error, OperationType.CREATE, 'templates');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-700">Nama Template</label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Ramadan 2026"
          className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-700">Dimensi</label>
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => setSize('1080x1080')}
            className={cn(
              "py-2 rounded-xl border font-medium transition-all",
              size === '1080x1080' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-600 border-neutral-200 hover:border-emerald-300"
            )}
          >
            1080 x 1080
          </button>
          <button 
            type="button"
            onClick={() => setSize('1080x1920')}
            className={cn(
              "py-2 rounded-xl border font-medium transition-all",
              size === '1080x1920' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-600 border-neutral-200 hover:border-emerald-300"
            )}
          >
            1080 x 1920
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-700">Gambar Template (PNG transparan)</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-50 transition-all overflow-hidden relative group",
            size === '1080x1080' ? "aspect-square" : "aspect-[9/16] max-h-[400px] w-full max-w-[250px] mx-auto"
          )}
        >
          {preview ? (
            <>
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white font-bold">Ganti Gambar</p>
              </div>
            </>
          ) : (
            <>
              <Plus className="w-8 h-8 text-neutral-300 mb-2" />
              <p className="text-xs text-neutral-500 text-center px-4">Klik untuk unggah<br/>(Otomatis resize jika &gt; 1MB)</p>
            </>
          )}
        </div>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png"
          className="hidden"
        />
      </div>

      <button 
        type="submit"
        disabled={uploading || !name || !preview}
        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Mengunggah...</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            <span>Unggah Template</span>
          </>
        )}
      </button>
    </form>
  );
}

function AdminTemplateList({ templates }: { templates: Template[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'templates', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `templates/${id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative mb-4">
        <input 
          type="text"
          placeholder="Cari berdasarkan nama..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full bg-neutral-50"
        />
        <ImageIcon className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-200">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-100 bg-neutral-50 group hover:border-emerald-200 transition-all">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-neutral-200 flex-shrink-0">
              <img 
                src={template.imageData} 
                alt={template.name} 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-grow min-w-0">
              <h4 className="font-bold text-neutral-800 truncate">{template.name}</h4>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">{template.size}</p>
              <p className="text-[10px] text-neutral-400 mt-1">ID: {template.id}</p>
            </div>
            
            {deletingId === template.id ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDelete(template.id)}
                  className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  title="Konfirmasi Hapus"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setDeletingId(null)}
                  className="p-2 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 transition-colors"
                  title="Batal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setDeletingId(template.id)}
                className="p-3 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-20 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
            <p className="text-neutral-500 font-medium">Tidak ada template ditemukan.</p>
            <p className="text-xs text-neutral-400 mt-1">Coba kata kunci lain atau unggah desain baru.</p>
          </div>
        )}
      </div>
    </div>
  );
}
function TwibbonEditor({ template, initialPhoto, onBack }: { template: Template, initialPhoto: string | null, onBack: () => void }) {
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [activeLayer, setActiveLayer] = useState<'photo' | 'mascot'>('photo');
  const [isGeneratingMascot, setIsGeneratingMascot] = useState(false);
  
  const [editorState, setEditorState] = useState<EditorState>({
    photo: initialPhoto,
    scale: 1,
    x: 0,
    y: 0,
    mascot: null,
    mascotScale: 0.5,
    mascotX: 100,
    mascotY: 100
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const [canvasWidth, canvasHeight] = template.size.split('x').map(Number);

  const handleGenerateMascot = async () => {
    if (!photo) return;
    
    setIsGeneratingMascot(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const base64Data = photo.split(',')[1];
      const mimeType = photo.split(';')[0].split(':')[1];
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              {
                text: "Create a 3D Disney/Pixar style cartoon mascot character based on the person in this photo. The character MUST mirror the EXACT body pose, hand positions, head tilt, and facial expression of the person in the photo. It should look like a 3D render of the same person. IMPORTANT: The character must be isolated on a SOLID, PURE WHITE background (#FFFFFF) with NO shadows or gradients on the background. High-quality 3D animation style, vibrant colors, cinematic lighting, 8k resolution."
              }
            ]
          }
        ]
      });
      
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const mascotBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            setEditorState(prev => ({ 
              ...prev, 
              mascot: mascotBase64,
              mascotScale: 0.6,
              mascotX: canvasWidth * 0.1,
              mascotY: canvasHeight * 0.3
            }));
            setActiveLayer('mascot');
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        }
      }
    } catch (error) {
      console.error('Mascot generation error:', error);
      alert('Gagal membuat maskot AI.');
    } finally {
      setIsGeneratingMascot(false);
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    const render = async () => {
      setIsRendering(true);
      try {
        const templateImg = await loadImage(template.imageData);
        let userImg: HTMLImageElement | null = null;
        if (photo) {
          userImg = await loadImage(photo);
        }

        let mascotImg: HTMLImageElement | null = null;
        if (editorState.mascot) {
          mascotImg = await loadImage(editorState.mascot);
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw user photo
        if (userImg) {
          const drawWidth = userImg.width * editorState.scale;
          const drawHeight = userImg.height * editorState.scale;
          
          const drawX = (canvas.width / 2) - (drawWidth / 2) + editorState.x;
          const drawY = (canvas.height / 2) - (drawHeight / 2) + editorState.y;

          ctx.save();
          ctx.drawImage(userImg, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        }

        // Draw template on top
        ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

        // Draw AI Mascot on top of template (as requested "di depan templet")
        if (mascotImg) {
          const mScale = editorState.mascotScale || 0.5;
          const mWidth = mascotImg.width * mScale;
          const mHeight = mascotImg.height * mScale;
          
          const mX = editorState.mascotX || 0;
          const mY = editorState.mascotY || 0;

          ctx.save();
          // Simple background removal for white background
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = mascotImg.width;
          tempCanvas.height = mascotImg.height;
          const tCtx = tempCanvas.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(mascotImg, 0, 0);
            const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            // Improved background removal with threshold and alpha blending
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Calculate "whiteness"
              const brightness = (r + g + b) / 3;
              const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
              
              // If pixel is very bright and has low color variance (neutral white/gray)
              if (brightness > 235 && diff < 20) {
                // Smooth transition for edges
                const alpha = Math.max(0, Math.min(255, (255 - brightness) * 5));
                data[i + 3] = alpha < 50 ? 0 : alpha;
              }
            }
            tCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(tempCanvas, mX, mY, mWidth, mHeight);
          } else {
            ctx.drawImage(mascotImg, mX, mY, mWidth, mHeight);
          }
          ctx.restore();
        }
      } catch (error) {
        console.error('Error drawing canvas:', error);
      } finally {
        setIsRendering(false);
      }
    };

    return render();
  }, [photo, editorState, template, canvasWidth, canvasHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        // Reset editor state
        setEditorState({
          photo: reader.result as string,
          scale: 1,
          x: 0,
          y: 0
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsProcessing(true);
    
    // Ensure the latest state is drawn
    await draw();
    
    // Small timeout to allow UI to show processing state
    setTimeout(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        setResultImage(dataUrl);
        
        const link = document.createElement('a');
        link.download = `twibbon-${template.name.toLowerCase().replace(/\s+/g, '-')}-${template.size}.png`;
        link.href = dataUrl;
        link.click();
        
        setIsProcessing(false);
        setIsSuccess(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });
      } catch (error) {
        console.error('Download error:', error);
        alert('Gagal mengunduh gambar. Silakan coba lagi.');
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsProcessing(true);
    try {
      // Ensure the latest state is drawn
      await draw();
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      setResultImage(dataUrl);
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'twibbon.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Twibbon',
          text: 'Check out my custom Twibbon!',
        });
        setIsProcessing(false);
        setIsSuccess(true);
      } else {
        // Fallback for browsers that don't support file sharing
        setIsProcessing(false);
        handleDownload();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      setIsProcessing(false);
      handleDownload();
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!photo) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setLastPos({ x: clientX, y: clientY });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !photo) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - lastPos.x;
    const dy = clientY - lastPos.y;
    
    if (activeLayer === 'photo') {
      setEditorState(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
    } else if (activeLayer === 'mascot') {
      setEditorState(prev => ({
        ...prev,
        mascotX: (prev.mascotX || 0) + dx,
        mascotY: (prev.mascotY || 0) + dy
      }));
    }
    setLastPos({ x: clientX, y: clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (isSuccess && resultImage) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto space-y-8 text-center"
      >
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-200 space-y-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-neutral-900">Luar Biasa!</h2>
            <p className="text-neutral-600">Twibbon Anda sudah siap. Bagikan ke teman-teman Anda!</p>
          </div>
          
          <div className="aspect-square rounded-2xl overflow-hidden border border-neutral-100 shadow-inner bg-neutral-50">
            <img src={resultImage} alt="Result" className="w-full h-full object-contain" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={handleShare}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Bagikan ke Media Sosial
            </button>
            <button 
              onClick={handleDownload}
              className="w-full bg-white text-neutral-700 py-4 rounded-2xl font-bold border border-neutral-200 hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Simpan ke Galeri
            </button>
            <button 
              onClick={onBack}
              className="w-full text-neutral-500 py-2 font-medium hover:text-neutral-900 transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-medium transition-colors bg-white px-4 py-2 rounded-full border border-neutral-200 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Kembali</span>
        </button>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate max-w-[150px] sm:max-w-none">{template.name}</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleShare}
            disabled={!photo || isProcessing}
            className="bg-white text-emerald-600 p-2.5 sm:px-4 sm:py-2.5 rounded-full font-bold border border-emerald-100 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
            title="Bagikan"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
            <span className="hidden sm:inline">Bagikan</span>
          </button>
          <button 
            onClick={handleDownload}
            disabled={!photo || isProcessing}
            className="bg-emerald-600 text-white p-2.5 sm:px-6 sm:py-2.5 rounded-full font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
            title="Simpan"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            <span className="hidden sm:inline">Simpan</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Canvas Preview */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-neutral-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 overflow-hidden min-h-[500px] lg:min-h-[700px]">
          <div className="mb-4 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-white shadow-sm">
            <Maximize className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{template.size} PX</span>
          </div>
          
          <div 
            className="relative shadow-2xl bg-white overflow-hidden cursor-move touch-none"
            style={{ 
              width: canvasWidth > canvasHeight ? '100%' : 'auto', 
              height: canvasWidth > canvasHeight ? 'auto' : '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${canvasWidth}/${canvasHeight}`
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            <canvas 
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="w-full h-full"
            />
            
            {/* Mascot Generation Overlay */}
            <AnimatePresence>
              {isGeneratingMascot && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-10"
                >
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-emerald-600 animate-pulse" />
                  </div>
                  <p className="mt-4 text-emerald-800 font-bold text-center px-6">
                    Sedang Merancang Maskot AI Anda...
                  </p>
                  <p className="text-emerald-600/70 text-xs mt-1">Ini mungkin memerlukan waktu beberapa detik</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!photo && (
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 backdrop-blur-[2px] cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-emerald-600 mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="text-neutral-800 font-bold">Klik untuk unggah foto</p>
                <p className="text-neutral-500 text-sm">PNG atau JPG</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-sm space-y-4 sm:space-y-6">
            {/* Layer Tabs */}
            <div className="flex p-1 bg-neutral-100 rounded-xl">
              <button 
                onClick={() => setActiveLayer('photo')}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                  activeLayer === 'photo' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                <ImageIcon className="w-4 h-4" />
                Foto Utama
              </button>
              <button 
                onClick={() => setActiveLayer('mascot')}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                  activeLayer === 'mascot' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                <Sparkles className="w-4 h-4" />
                Maskot AI
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                {activeLayer === 'photo' ? 'Atur Foto Utama' : 'Atur Maskot AI'}
              </h3>
              
              <div className="space-y-4">
                {activeLayer === 'photo' ? (
                  <>
                    <button 
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-emerald-100 text-emerald-700 font-bold hover:bg-emerald-50 transition-all"
                    >
                      <ImageIcon className="w-5 h-5" />
                      {photo ? 'Ganti Foto' : 'Pilih Foto'}
                    </button>
                    <input 
                      type="file" 
                      ref={photoInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    {photo && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold text-neutral-600">
                          <label className="flex items-center gap-1"><ZoomIn className="w-4 h-4" /> Zoom Foto</label>
                          <span>{Math.round(editorState.scale * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="3" 
                          step="0.01"
                          value={editorState.scale}
                          onChange={(e) => setEditorState(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                          className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    {!editorState.mascot ? (
                      <button 
                        onClick={handleGenerateMascot}
                        disabled={isGeneratingMascot || !photo}
                        className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-50 transition-all disabled:opacity-50"
                      >
                        {isGeneratingMascot ? (
                          <>
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span>Sedang Membuat Maskot...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-8 h-8" />
                            <span>Buat Maskot AI dari Foto</span>
                            <span className="text-[10px] font-normal text-neutral-400">Karakter 3D Disney akan muncul di depan bingkai</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleGenerateMascot}
                            disabled={isGeneratingMascot}
                            className="flex-1 py-2 rounded-xl border border-emerald-200 text-emerald-700 font-bold text-xs hover:bg-emerald-50 transition-all flex items-center justify-center gap-1"
                          >
                            {isGeneratingMascot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            Buat Ulang
                          </button>
                          <button 
                            onClick={() => setEditorState(prev => ({ ...prev, mascot: null }))}
                            className="py-2 px-4 rounded-xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-all"
                          >
                            Hapus
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-semibold text-neutral-600">
                            <label className="flex items-center gap-1"><ZoomIn className="w-4 h-4" /> Zoom Maskot</label>
                            <span>{Math.round((editorState.mascotScale || 0.5) * 100)}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.1" 
                            max="2" 
                            step="0.01"
                            value={editorState.mascotScale || 0.5}
                            onChange={(e) => setEditorState(prev => ({ ...prev, mascotScale: parseFloat(e.target.value) }))}
                            className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {photo && (
                  <div className="pt-4 border-t border-neutral-100">
                    <p className="text-xs text-neutral-400 flex items-center gap-1 mb-4">
                      <Move className="w-3 h-3" /> Tips: Geser {activeLayer === 'photo' ? 'foto' : 'maskot'} di kanvas untuk memindahkan posisinya.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          if (activeLayer === 'photo') {
                            setEditorState(prev => ({ ...prev, x: 0, y: 0, scale: 1 }));
                          } else {
                            setEditorState(prev => ({ ...prev, mascotX: canvasWidth * 0.2, mascotY: canvasHeight * 0.2, mascotScale: 0.4 }));
                          }
                        }}
                        className="py-2 rounded-xl bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-sm"
                      >
                        Atur Ulang
                      </button>
                      <button 
                          onClick={handleDownload}
                          className="py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all text-sm shadow-lg shadow-emerald-100"
                        >
                          Unduh Hasil
                        </button>
                      </div>
                    </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <h4 className="font-bold text-emerald-800 mb-2">Instruksi:</h4>
            <ul className="text-sm text-emerald-700 space-y-2 list-disc list-inside">
              <li>Unggah foto Anda yang jelas.</li>
              <li>Gunakan slider untuk memperbesar atau memperkecil.</li>
              <li>Geser foto untuk menyesuaikan posisi dengan bingkai.</li>
              <li>Klik unduh untuk menyimpan Twibbon Anda!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
