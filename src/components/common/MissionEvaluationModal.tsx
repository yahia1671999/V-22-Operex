import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, CheckCircle2, Star, Clock, FileCheck, Users, X, AlertCircle } from 'lucide-react';
import { Mission, MissionEvaluation } from '../../types';

interface MissionEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: (Mission & { rawId?: string; employeeName?: string; department?: string; type?: string; reason?: string }) | null;
  employeeName?: string;
  departmentName?: string;
  onSubmitEvaluation: (missionId: string, evaluation: MissionEvaluation, markCompleted: boolean) => Promise<void>;
  isSubmitting?: boolean;
}

export const MissionEvaluationModal: React.FC<MissionEvaluationModalProps> = ({
  isOpen,
  onClose,
  mission,
  employeeName,
  departmentName,
  onSubmitEvaluation,
  isSubmitting = false
}) => {
  const [timeAdherence, setTimeAdherence] = useState<number>(85);
  const [qualityResults, setQualityResults] = useState<number>(85);
  const [conductCooperation, setConductCooperation] = useState<number>(85);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (mission?.evaluation) {
      setTimeAdherence(mission.evaluation.timeAdherence ?? 85);
      setQualityResults(mission.evaluation.qualityResults ?? 85);
      setConductCooperation(mission.evaluation.conductCooperation ?? 85);
      setNotes(mission.evaluation.notes || '');
    } else {
      setTimeAdherence(85);
      setQualityResults(85);
      setConductCooperation(85);
      setNotes('');
    }
  }, [mission]);

  if (!isOpen || !mission) return null;

  const weightedTime = (timeAdherence * 0.40);
  const weightedQuality = (qualityResults * 0.30);
  const weightedConduct = (conductCooperation * 0.30);
  const finalScore = Math.round((weightedTime + weightedQuality + weightedConduct) * 10) / 10;

  const getRatingGrade = (score: number): 'ممتاز' | 'جيد جداً' | 'جيد' | 'يحتاج تحسين' => {
    if (score >= 90) return 'ممتاز';
    if (score >= 80) return 'جيد جداً';
    if (score >= 70) return 'جيد';
    return 'يحتاج تحسين';
  };

  const ratingGrade = getRatingGrade(finalScore);

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case 'ممتاز':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'جيد جداً':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'جيد':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      default:
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
    }
  };

  const handleSubmit = async (markCompleted: boolean = true) => {
    const evaluationObj: MissionEvaluation = {
      timeAdherence,
      qualityResults,
      conductCooperation,
      finalScore,
      ratingGrade,
      notes,
      evaluatedAt: new Date().toISOString()
    };

    const targetId = mission.rawId || mission.id;
    await onSubmitEvaluation(targetId, evaluationObj, markCompleted);
  };

  const empNameDisplay = employeeName || mission.employeeName || 'الموظف';
  const deptDisplay = departmentName || mission.department || 'القسم';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border-2 border-border max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative text-right"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-6 bg-muted/30 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-primary" />
                <h2 className="text-lg font-black text-foreground">
                  تقييم أداء الموظف عند اكتمال المأمورية
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-semibold">
                يقوم المدير المباشر بتقييم أداء الموظف وفق معايير التقييم الـ 3 المحددة للمأموريات.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1 overscroll-contain">

          {/* Mission & Employee Info Banner */}
          <div className="bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-foreground">{empNameDisplay}</span>
                <span className="text-xs text-muted-foreground font-bold">• {deptDisplay}</span>
              </div>
              <span className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/30 text-[11px] font-bold">
                {mission.type || 'مأمورية رسمية'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground font-semibold">
              <div>الفترة: من <strong className="text-foreground">{mission.startDate}</strong> إلى <strong className="text-foreground">{mission.endDate}</strong></div>
              <div className="truncate">البيان: <span className="text-foreground">{mission.notes || mission.reason || 'مأمورية عمل رسمية'}</span></div>
            </div>
          </div>

          {/* Criteria Evaluation Controls */}
          <div className="space-y-5">
            {/* Criterion 1: Time & Schedule Adherence (40%) */}
            <div className="p-4 bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="font-black text-xs text-foreground">
                    1. الالتزام بالوقت والجدول الزمني (الوزن: 40%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 border border-blue-500/20">
                    النتيجة: {timeAdherence}% (الموزون: {weightedTime.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                الانضباط بمواعيد بدء وانتهاء المأمورية، والالتزام بالجدول الزمني المخطط للمهام.
              </p>
              
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={timeAdherence}
                  onChange={(e) => setTimeAdherence(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={timeAdherence}
                  onChange={(e) => setTimeAdherence(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 px-2 py-1 bg-background border border-border font-mono font-bold text-center text-xs"
                />
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 flex-wrap">
                {[100, 90, 80, 70, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTimeAdherence(val)}
                    className={`px-2 py-1 text-[10px] font-bold border transition-all ${
                      timeAdherence === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Criterion 2: Quality of Results & Deliverables (30%) */}
            <div className="p-4 bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-black text-xs text-foreground">
                    2. جودة النتائج والمخرجات والتقرير (الوزن: 30%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                    النتيجة: {qualityResults}% (الموزون: {weightedQuality.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                كفاءة التنفيذ ودقة النتائج المحققة، ومدى اكتمال التقرير النهائي أو المخرجات المطلوبة.
              </p>
              
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={qualityResults}
                  onChange={(e) => setQualityResults(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={qualityResults}
                  onChange={(e) => setQualityResults(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 px-2 py-1 bg-background border border-border font-mono font-bold text-center text-xs"
                />
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 flex-wrap">
                {[100, 90, 80, 70, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQualityResults(val)}
                    className={`px-2 py-1 text-[10px] font-bold border transition-all ${
                      qualityResults === val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Criterion 3: Commitment, Cooperation & Conduct (30%) */}
            <div className="p-4 bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <span className="font-black text-xs text-foreground">
                    3. الالتزام والتعاون والسلوك المهني (الوزن: 30%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-purple-600 bg-purple-500/10 px-2 py-0.5 border border-purple-500/20">
                    النتيجة: {conductCooperation}% (الموزون: {weightedConduct.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                التواصل الفعال مع فريق العمل أو الجهات الخارجية، المرونة، والانضباط بالسلوك المهني.
              </p>
              
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={conductCooperation}
                  onChange={(e) => setConductCooperation(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={conductCooperation}
                  onChange={(e) => setConductCooperation(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 px-2 py-1 bg-background border border-border font-mono font-bold text-center text-xs"
                />
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 flex-wrap">
                {[100, 90, 80, 70, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setConductCooperation(val)}
                    className={`px-2 py-1 text-[10px] font-bold border transition-all ${
                      conductCooperation === val ? 'bg-purple-600 text-white border-purple-600' : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Total Calculated Score Summary */}
          <div className="p-4 bg-card border-2 border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-xs font-black text-muted-foreground block">النتيجة الكلية الموزونة للمأمورية:</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-black font-mono text-primary">{finalScore}%</span>
                <span className={`px-3 py-1 font-black text-xs border ${getGradeBadgeColor(ratingGrade)}`}>
                  {ratingGrade}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground space-y-0.5 border-t sm:border-t-0 sm:border-r border-border pt-2 sm:pt-0 sm:pr-4">
              <div>الالتزام بالوقت (40%): <strong className="text-foreground">{weightedTime.toFixed(1)}%</strong></div>
              <div>جودة النتائج (30%): <strong className="text-foreground">{weightedQuality.toFixed(1)}%</strong></div>
              <div>التعاون والسلوك (30%): <strong className="text-foreground">{weightedConduct.toFixed(1)}%</strong></div>
            </div>
          </div>

          {/* Manager Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-foreground block">
              ملاحظات وتوصيات المدير المباشر:
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي ملاحظات إضافية حول أداء الموظف أو مخرجات المأمورية..."
              className="w-full p-3 bg-background border border-border text-xs outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
            />
          </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-border p-4 bg-muted/20 shrink-0 mt-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-muted text-muted-foreground font-bold text-xs hover:bg-muted/80 transition-all border border-border disabled:opacity-50 cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'جاري الاعتماد والتقييم...' : 'اعتماد التقييم واكتمال المأمورية'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
