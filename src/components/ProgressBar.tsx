
import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  progress: number
  label?: string
  showPercentage?: boolean
}

function ProgressBar({
  progress,
  label,
  showPercentage = true,
}: ProgressBarProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {label && <span>{label}</span>}
        {showPercentage && <strong>{safeProgress}%</strong>}
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={safeProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Reading progress'}
      >
        <div
          className={styles.fill}
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
