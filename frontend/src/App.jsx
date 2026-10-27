import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, UploadCloud, Cpu, Zap, Lock, ChevronDown, ChevronUp, Twitter, Linkedin, Github, RefreshCw } from 'lucide-react';
import AnalysisSummary from './AnalysisSummary';
import { requestPrediction } from './api';
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5002').replace(/\/$/, '');

// Main App Component
const App = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Animation Variants for Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  const cardHover = {
    scale: 1.03,
    transition: { duration: 0.3 }
  };

  // Handle smooth scrolling for navigation
  const handleNavClick = (e) => {
    e.preventDefault();
    const targetId = e.currentTarget.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const selectImage = useCallback((file) => {
    if (!file) return;
    setResult(null);
    setUploadError(null);
    if (file.type && !file.type.startsWith('image/')) {
      setImage(null);
      setIsLoading(false);
      setUploadError('Choose a JPEG, PNG, WEBP or AVIF image.');
      return;
    }
    setImage(file);
  }, []);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    selectImage(file);
  };

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    selectImage(file);
  }, [selectImage]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);


  // Create image preview and call API for analysis
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);

    // Call the backend API
    setIsLoading(true);
    setResult(null);
    setUploadError(null);
    const controller = new AbortController();

    const analyzeImage = async () => {
      try {
        const data = await requestPrediction(image, {
          baseUrl: API_BASE_URL, signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResult({
          detection: data.detection,
          confidence: data.confidence,
          explanation: data.explanation,
          visual_evidence: data.visual_evidence,
          visual_review: data.visual_review,
        });
        setIsLoading(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Error analyzing image:', error);
        setResult(null);
        setUploadError(error.message);
        setIsLoading(false);
      }
    };

    analyzeImage();

    // Cleanup
    return () => {
        controller.abort();
        URL.revokeObjectURL(objectUrl);
    }
  }, [image]);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const resetUploader = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setUploadError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  const faqData = [
    {
      question: "How accurate is Real Reveal's detection?",
      answer: "RealReveal is a research prototype. Results can be wrong, especially for unfamiliar generators, compressed images or edited photographs. The confidence score is a model output, not a guarantee. Check the original source before trusting or sharing an image."
    },
    {
      question: "What types of image formats can I upload?",
      answer: "We support JPEG, PNG, WEBP and AVIF images up to 8 MB. Other image formats must be exported to a supported format first. Video analysis is not supported."
    },
    {
      question: "Is my data secure when I upload an image?",
      answer: "The local API processes images without intentionally saving them. When IBM visual review is enabled, a resized copy of your uploaded image is sent to IBM Watsonx for analysis. The local classifier and heatmap run on this computer. Text-only IBM guidance receives the prediction and attention summary."
    },
  ];

  return (
    <div className="bg-gray-900 min-h-screen font-sans text-gray-300">
      {/* Header */}
      <Motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-gray-900/70 backdrop-blur-lg fixed top-0 left-0 right-0 z-50 border-b border-gray-700"
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold text-white tracking-tight">Real Reveal</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#tech" onClick={handleNavClick} className="text-gray-400 hover:text-blue-400 transition-colors">Technology</a>
            <a href="#features" onClick={handleNavClick} className="text-gray-400 hover:text-blue-400 transition-colors">Features</a>
            <a href="#faq" onClick={handleNavClick} className="text-gray-400 hover:text-blue-400 transition-colors">FAQ</a>
          </nav>
          <Motion.a
            href="#upload"
            onClick={handleNavClick}
            whileHover={{ scale: 1.05, boxShadow: '0px 0px 12px rgb(59 130 246 / 0.5)' }}
            whileTap={{ scale: 0.95 }}
            className="hidden md:inline-block bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg transition-all shadow-md"
          >
            Check Image
          </Motion.a>
        </div>
      </Motion.header>

      <main className="pt-20">
        {/* Hero Section */}
        <section id="upload" className="text-center py-20 md:py-24 bg-gray-900 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-900/50 rounded-full blur-3xl animate-pulse"></div>
            <div className="container mx-auto px-6 relative z-10">
                <Motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <Motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4">
                      Detect Digital Forgeries with AI
                    </Motion.h1>
                    <Motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-8">
                      Check an image for signs of AI generation with our research prototype. Use the prediction alongside source verification before sharing.
                    </Motion.p>
                </Motion.div>
                <Motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="mt-8"
                >
                    <div
                        className="bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-xl p-8 md:p-12 max-w-2xl mx-auto hover:border-blue-500 transition-all cursor-pointer group backdrop-blur-sm"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => fileInputRef.current.click()}
                    >
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" />
                      <UploadCloud className="w-16 h-16 text-gray-500 mx-auto mb-4 group-hover:text-blue-400 transition-colors" />
                      <h3 className="text-xl font-semibold text-white mb-2">Drag & Drop Your Image Here</h3>
                      <p className="text-gray-500 mb-6">or click to browse files</p>
                      <p className="text-xs text-gray-400 mb-4">When IBM visual review is enabled, uploaded images are sent to IBM Watsonx.</p>
                      <Motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-transform transform shadow-lg shadow-blue-600/30"
                      >
                        Upload Image
                      </Motion.button>
                    </div>
                </Motion.div>

                {/* Results Section */}
                <AnimatePresence>
                {(preview || isLoading || uploadError) && (
                    <Motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        transition={{ duration: 0.5 }}
                        className="mt-12 max-w-3xl mx-auto"
                    >
                        <div className="bg-gray-800/50 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
                            <h3 className="text-2xl font-bold text-white mb-6">Analysis Result</h3>
                            <div className="grid md:grid-cols-2 gap-8 items-center">
                                <div className="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                                    {preview && <img src={preview} alt="Uploaded preview" className="w-full h-full object-cover"/>}
                                </div>
                                <div className="text-left min-h-[150px]">
                                    <AnimatePresence mode="wait">
                                    {isLoading && (
                                        <Motion.div
                                            key="loading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col items-center justify-center h-full"
                                        >
                                            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                                            <p className="text-lg text-gray-300">Analyzing image and preparing explanation...</p>
                                        </Motion.div>
                                    )}
                                    {(result || uploadError) && (
                                        <Motion.div
                                            key={uploadError ? 'error' : 'result'}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="flex flex-col items-center md:items-start"
                                        >
                                            <AnalysisSummary result={result} error={uploadError} />
                                            <Motion.button
                                                onClick={resetUploader}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                className="mt-6 bg-gray-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                                            >
                                                Check Another Image
                                            </Motion.button>
                                        </Motion.div>
                                    )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </Motion.div>
                )}
                </AnimatePresence>
            </div>
        </section>

        {/* Sections with scroll animations */}
        {[
          {
            id: 'how-it-works',
            bgColor: 'bg-gray-800',
            title: 'Check Before You Share',
            subtitle: 'Our process is designed for speed and simplicity. Get your results in seconds.',
            content: (
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { title: 'Upload Image', description: 'Choose a JPEG, PNG, WEBP or AVIF image for the configured API to process.' },
                  { title: 'AI Analysis', description: 'An EfficientNetB0 classifier estimates whether the image resembles real or AI-generated training examples.' },
                  { title: 'Get Results', description: 'Review the prediction and model score, then check the original source and context.' }
                ].map((step, index) => (
                  <Motion.div key={index} variants={itemVariants} whileHover={cardHover} className="bg-gray-900/50 p-8 rounded-lg border border-gray-700">
                    <div className="bg-blue-900/50 border-2 border-blue-500 text-blue-300 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-4 mx-auto">{index + 1}</div>
                    <h3 className="text-xl font-semibold mb-2 text-white">{step.title}</h3>
                    <p className="text-gray-400">{step.description}</p>
                  </Motion.div>
                ))}
              </div>
            )
          },
          {
            id: 'tech',
            bgColor: 'bg-gray-900',
            title: 'Powered by Advanced AI',
            subtitle: 'An image classifier provides a starting point for verification. Predictions can be wrong.',
            content: (
              <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
                {[
                  { icon: Cpu, title: 'EfficientNetB0', description: 'Transfer learning adapts a convolutional network to classify real and AI-generated images.' },
                  { icon: Zap, title: 'Model Scores', description: 'Each result includes a prediction score. It is not a calibrated probability of authenticity.' },
                  { icon: Lock, title: 'Local Processing', description: 'Run the API on your own computer. The default setup uses no external AI service.' }
                ].map((tech, index) => (
                  <Motion.div key={index} variants={itemVariants} whileHover={cardHover} className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <tech.icon className="w-10 h-10 text-blue-500 mb-4" />
                    <h4 className="font-semibold text-lg text-white mb-2">{tech.title}</h4>
                    <p className="text-gray-400">{tech.description}</p>
                  </Motion.div>
                ))}
              </div>
            )
          }
        ].map(section => (
          <Motion.section
            key={section.id}
            id={section.id}
            className={`py-20 ${section.bgColor}`}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <div className="container mx-auto px-6 text-center">
              <Motion.div variants={itemVariants}>
                <h2 className="text-3xl font-bold text-white mb-3">{section.title}</h2>
                <p className="text-gray-400 max-w-2xl mx-auto mb-12">{section.subtitle}</p>
              </Motion.div>
              {section.content}
            </div>
          </Motion.section>
        ))}

        {/* Features Section */}
        <Motion.section
            id="features"
            className="py-20 bg-gray-800"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
        >
          <div className="container mx-auto px-6">
            <Motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white">An Unparalleled Detection Engine</h2>
            </Motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <Motion.div variants={itemVariants}>
                    <img src="https://placehold.co/600x400/1f2937/4f46e5?text=Feature+Visual" alt="Feature Visualization" className="rounded-lg shadow-lg" />
                </Motion.div>
                <Motion.div variants={itemVariants} className="space-y-6">
                    {[
                        { icon: Zap, title: "Blazing Fast Results", description: "Get a comprehensive analysis in under 5 seconds. No waiting, just answers." },
                        { icon: ShieldCheck, title: "High Accuracy", description: "Our industry-leading AI model provides reliable and trustworthy results." },
                        { icon: Lock, title: "Privacy First", description: "Your images are your own. We analyze them and then delete them. Simple as that." }
                    ].map((feature, index) => (
                        <div key={index} className="flex items-start">
                            <feature.icon className="w-7 h-7 text-blue-500 mr-4 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                                <p className="text-gray-400">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </Motion.div>
            </div>
          </div>
        </Motion.section>

        {/* FAQ Section */}
        <Motion.section
            id="faq"
            className="py-20 bg-gray-900"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
        >
          <div className="container mx-auto px-6 max-w-3xl">
            <Motion.h2 variants={itemVariants} className="text-3xl font-bold text-center text-white mb-10">Frequently Asked Questions</Motion.h2>
            <Motion.div variants={itemVariants} className="space-y-4">
              {faqData.map((faq, index) => (
                <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex justify-between items-center p-5 text-left font-semibold text-white focus:outline-none"
                  >
                    <span>{faq.question}</span>
                    <Motion.div animate={{ rotate: openFaq === index ? 180 : 0 }}>
                        <ChevronDown className="w-5 h-5 text-blue-400" />
                    </Motion.div>
                  </button>
                  <AnimatePresence>
                  {openFaq === index && (
                    <Motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 text-gray-400 border-t border-gray-700 pt-4">
                        <p>{faq.answer}</p>
                      </div>
                    </Motion.div>
                  )}
                  </AnimatePresence>
                </div>
              ))}
            </Motion.div>
          </div>
        </Motion.section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-700">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <ShieldCheck className="w-8 h-8 text-blue-500" />
                <span className="text-2xl font-bold text-white">Real Reveal</span>
              </div>
              <p className="text-gray-400">Fighting digital deception with AI.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-200 mb-4 tracking-wider uppercase">Links</h3>
              <ul className="space-y-2">
                <li><a href="#tech" onClick={handleNavClick} className="text-gray-400 hover:text-blue-400 transition-colors">Technology</a></li>
                <li><a href="#features" onClick={handleNavClick} className="text-gray-400 hover:text-blue-400 transition-colors">Features</a></li>
                <li><a href="#faq" onClick={handleNavClick} className="text-gray-400 hover:text-blue-400 transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-200 mb-4 tracking-wider uppercase">Connect</h3>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors"><Twitter className="w-6 h-6" /></a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors"><Linkedin className="w-6 h-6" /></a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors"><Github className="w-6 h-6" /></a>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>&copy; {new Date().getFullYear()} Real Reveal. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
