/**
 * data-loader.js
 *
 * 这个脚本负责直接从同一目录下读取表格文件，并转换为标准格式
 * 表格格式：省份、项目、地址、项目详情、日期、图片地址
 */

// 在页面加载时执行
document.addEventListener('DOMContentLoaded', function() {
    // 尝试加载数据
    loadScreenData();
});

// 加载大屏数据
async function loadScreenData() {
    try {
        // 首先检查localStorage是否已有数据
        const storedData = localStorage.getItem('screenData');
        if (storedData) {
            console.log('已从localStorage加载数据');

            // 检查当前页面是否是详情页
            if (window.location.pathname.includes('detail.html')) {
                // 如果是详情页，获取URL参数并加载相应的省份数据
                const urlParams = new URLSearchParams(window.location.search);
                const province = urlParams.get('province');

                if (province) {
                    loadProvinceData(province);
                }
            }

            return;
        }

        // 加载表格文件 (使用fetch API从同一目录下获取文件)
        const response = await fetch('screendata.xlsx');

        if (!response.ok) {
            console.error('无法加载表格文件，HTTP状态码:', response.status);
            // 显示数据加载失败提示
            showLoadError();
            return;
        }

        // 获取文件的二进制内容
        const arrayBuffer = await response.arrayBuffer();

        // 解析Excel文件
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 转换为JSON格式
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 检查数据格式并处理
        validateAndProcessData(jsonData);
    } catch (error) {
        console.error('加载或处理数据时出错:', error);
        // 显示数据加载失败提示
        showLoadError();
    }
}

// 显示数据加载错误
function showLoadError() {
    if (window.location.pathname.includes('detail.html')) {
        // 在详情页显示错误
        const urlParams = new URLSearchParams(window.location.search);
        const province = urlParams.get('province');

        if (province && typeof showEmptyState === 'function') {
            // 使用自定义错误消息
            showEmptyState(province, '数据加载失败，请确认表格文件存在并格式正确');
        }
    } else {
        // 在首页可以选择显示一个错误提示
        console.log('首页数据加载失败');
    }
}

// 验证和处理数据
function validateAndProcessData(jsonData) {
    // 检查是否有数据
    if (!jsonData || jsonData.length === 0) {
        console.error('表格中没有数据');
        showLoadError();
        return;
    }

    // 转换为标准格式
    const standardData = transformData(jsonData);

    // 过滤掉无效数据（如空的记录）
    const validData = standardData.filter(item => {
        // 至少要有省份和项目名称
        return item.province && item.projectName;
    });

    if (validData.length === 0) {
        console.error('没有有效的数据记录');
        showLoadError();
        return;
    }

    // 按省份组织数据
    const organizedData = organizeByProvince(validData);

    // 保存到localStorage
    saveToLocalStorage(organizedData);

    console.log('数据已成功加载和处理:', organizedData);

    // 如果是详情页，加载相应的省份数据
    if (window.location.pathname.includes('detail.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const province = urlParams.get('province');

        if (province) {
            loadProvinceData(province);
        }
    }
}

// 转换数据为标准格式
function transformData(jsonData) {
    return jsonData.map(row => {
        // 确保所有字段都存在，防止undefined
        const province = row['省份'] || '';
        const projectName = row['项目'] || '';
        const address = row['地址'] || '';
        const detailOriginal = row['项目详情'] || '';
        const displayDate = row['日期'] || '';
        const imagePath = row['图片地址'] || '';

        // 解析项目详情字段，提取大屏位置和亮屏时间
        let screenLocation = '';
        let screenTime = '';

        if (detailOriginal) {
            const detailText = detailOriginal.toString();

            // 检查是否包含多行信息
            if (detailText.includes('大屏位置') || detailText.includes('亮屏时间')) {
                // 按行分割
                const detailLines = detailText.split(/[\r\n]+/);

                // 寻找位置和时间信息
                detailLines.forEach(line => {
                    if (line.includes('大屏位置')) {
                        screenLocation = line.replace(/大屏位置[：:]\s*/, '').trim();
                    } else if (line.includes('亮屏时间')) {
                        screenTime = line.replace(/亮屏时间[：:]\s*/, '').trim();
                    }
                });
            } else {
                // 如果没有特定标记，将整个内容作为位置信息
                screenLocation = detailText.trim();
            }
        }

        return {
            province: province,
            projectName: projectName,
            address: address,
            screenLocation: screenLocation,
            screenTime: screenTime,
            detailOriginal: detailOriginal,
            displayDate: displayDate,
            imagePath: imagePath
        };
    });
}

// 按省份组织数据
function organizeByProvince(data) {
    // 结果对象
    const result = {
        byProvince: {},
    };

    // 处理每条记录
    data.forEach(item => {
        if (!item.province) return; // 跳过没有省份的记录

        // 按省份组织
        if (!result.byProvince[item.province]) {
            result.byProvince[item.province] = [];
        }
        result.byProvince[item.province].push(item);
    });

    return result;
}

// 保存到localStorage
function saveToLocalStorage(data) {
    localStorage.setItem('screenData', JSON.stringify({
        byProvince: data.byProvince,
        lastUpdated: new Date().toISOString()
    }));
}

// 加载省份数据（用于详情页）
function loadProvinceData(province) {
    // 从localStorage中获取数据
    const storedData = localStorage.getItem('screenData');

    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData);

            if (parsedData.byProvince) {
                // 查找匹配的省份
                let matchFound = false;

                for (const provinceName in parsedData.byProvince) {
                    // 规范化省份名称以便比较
                    const normalizedProvinceName = provinceName.replace(/[省市自治区]/g, '');
                    const normalizedParam = province.replace(/[省市自治区]/g, '');

                    if (normalizedProvinceName === normalizedParam) {
                        // 找到匹配的省份
                        const provinceData = parsedData.byProvince[provinceName];

                        // 更新页面（如果updatePageForProvince函数存在）
                        if (typeof updatePageForProvince === 'function') {
                            updatePageForProvince(provinceName, provinceData);
                            matchFound = true;
                            break;
                        }
                    }
                }

                // 如果没有找到匹配的省份
                if (!matchFound && typeof showEmptyState === 'function') {
                    showEmptyState(province);
                }
            } else if (typeof showEmptyState === 'function') {
                showEmptyState(province);
            }
        } catch (error) {
            console.error('解析数据时出错:', error);
            if (typeof showEmptyState === 'function') {
                showEmptyState(province, '数据解析错误');
            }
        }
    } else if (typeof showEmptyState === 'function') {
        // 如果没有数据，显示空状态
        showEmptyState(province);
    }
}