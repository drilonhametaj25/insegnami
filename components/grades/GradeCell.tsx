'use client';

import { Badge, Tooltip, UnstyledButton, Text } from '@mantine/core';
import { getGradeColor, gradeTypeLabels, Grade } from '@/lib/hooks/useGrades';
import { GradeType } from '@prisma/client';

interface GradeCellProps {
  grade: Grade;
  onClick?: (grade: Grade) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeCell({ grade, onClick, size = 'md' }: GradeCellProps) {
  const value = Number(grade.value);
  const color = getGradeColor(value);
  const typeLabel = gradeTypeLabels[grade.type as GradeType] || grade.type;

  const formattedDate = new Date(grade.date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
  });

  const sizeStyles = {
    sm: { fontSize: '0.75rem', padding: '2px 6px', minWidth: '28px' },
    md: { fontSize: '0.875rem', padding: '4px 10px', minWidth: '36px' },
    lg: { fontSize: '1rem', padding: '6px 14px', minWidth: '44px' },
  };

  const tooltipContent = (
    <div style={{ textAlign: 'center' }}>
      <Text size="sm" fw={600}>{typeLabel}</Text>
      <Text size="xs" c="dimmed">{formattedDate}</Text>
      {grade.description && (
        <Text size="xs" mt={4}>{grade.description}</Text>
      )}
      {grade.weight !== 1 && (
        <Text size="xs" c="dimmed">Peso: {Number(grade.weight).toFixed(1)}</Text>
      )}
    </div>
  );

  const cell = (
    <Badge
      variant="filled"
      style={{
        backgroundColor: color,
        color: 'white',
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 700,
        ...sizeStyles[size],
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {value.toFixed(value % 1 === 0 ? 0 : 1)}
    </Badge>
  );

  if (onClick) {
    return (
      <Tooltip label={tooltipContent} position="top" withArrow>
        <UnstyledButton onClick={() => onClick(grade)}>
          {cell}
        </UnstyledButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={tooltipContent} position="top" withArrow>
      {cell}
    </Tooltip>
  );
}

interface GradeAverageProps {
  average: number | null;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function GradeAverage({ average, size = 'md', label }: GradeAverageProps) {
  if (average === null || average === undefined) {
    return (
      <Badge variant="outline" color="gray" size={size}>
        -
      </Badge>
    );
  }

  const color = getGradeColor(average);

  const sizeStyles = {
    sm: { fontSize: '0.75rem', padding: '2px 6px' },
    md: { fontSize: '0.875rem', padding: '4px 10px' },
    lg: { fontSize: '1rem', padding: '6px 14px' },
  };

  return (
    <Tooltip label={label || `Media: ${average.toFixed(2)}`} position="top" withArrow>
      <Badge
        variant="filled"
        style={{
          backgroundColor: color,
          color: 'white',
          fontWeight: 700,
          ...sizeStyles[size],
        }}
      >
        {average.toFixed(2)}
      </Badge>
    </Tooltip>
  );
}

// Mini grade indicator for compact views
interface GradeMiniProps {
  value: number;
}

export function GradeMini({ value }: GradeMiniProps) {
  const color = getGradeColor(value);

  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: '4px',
      }}
    />
  );
}
