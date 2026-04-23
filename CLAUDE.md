# CLAUDE.md — 프로젝트 규칙

## Git / GitHub 명령 실행 규칙

### 삭제 관련 명령 — 매번 사용자 승인 필수
아래 명령은 실행 전 반드시 사용자에게 확인을 받아야 합니다. 이전에 승인한 적이 있어도 예외 없이 매번 확인합니다.

- `git branch -D` / `git branch -d` (브랜치 삭제)
- `git rm` (파일 삭제)
- `git reset --hard` (변경사항 강제 폐기)
- `git push --force` / `git push -f` (강제 푸시)
- `git clean` (추적되지 않는 파일 삭제)
- `gh repo delete` (저장소 삭제)
- 그 외 되돌릴 수 없는 삭제·파괴적 git 명령 일체

### 그 외 Git / GitHub 명령 — 첫 번째 실행 시 1회만 확인
`git add`, `git commit`, `git push`, `git pull`, `git merge`, `gh pr create` 등
일반적인 git/GitHub 명령은 대화 세션 내 **처음 실행할 때 한 번만** 사용자에게 확인합니다.
같은 세션에서 동일한 유형의 명령이 반복될 경우 추가 확인 없이 자동으로 수행합니다.
