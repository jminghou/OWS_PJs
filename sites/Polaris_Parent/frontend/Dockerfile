# 使用 Node.js 官方鏡像
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製其餘程式碼
COPY . .

# 暴露前端埠口
EXPOSE 3000

# 啟動開發伺服器
CMD ["npm", "run", "dev"]