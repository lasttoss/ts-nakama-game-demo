{{- define "ts-nakama-game-demo.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "ts-nakama-game-demo.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "ts-nakama-game-demo.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- define "ts-nakama-game-demo.labels" -}}
app.kubernetes.io/name: {{ include "ts-nakama-game-demo.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}
{{- define "ts-nakama-game-demo.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ts-nakama-game-demo.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
